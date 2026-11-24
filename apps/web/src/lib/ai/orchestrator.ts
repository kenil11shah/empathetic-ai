/**
 * Conversation orchestrator — an explicit state machine:
 *
 *   SCREEN_INPUT -> (immediate? -> TEMPLATE_REPLY)
 *   -> INFER (baseline + transformer + LLM analysis in parallel)
 *   -> FUSE -> ROUTE (rule ∪ model, escalate-only) -> (concern template? -> TEMPLATE_REPLY)
 *   -> SELECT_STRATEGY -> DRAFT (LLM or demo) -> VALIDATE_ACTIONS -> OUTPUT_GUARD -> DONE
 *
 * Persistence and authorization happen in the API route; this module is pure logic plus
 * provider calls so it can be unit tested with the demo adapters.
 */
import { EMOTIONS, INTENTS, type Emotion, type EmotionOrUnknown, type Intent, type Mode } from "@/lib/constants";
import { checkOutput, combineRoutes, screenInput, type SafetyCategory, type SafetyRoute } from "@/lib/safety/policy";
import { fallbackReply, templateReply } from "@/lib/safety/templates";
import { resourcesFor } from "@/lib/safety/resources";
import { predictBaseline } from "@/lib/emotion/baseline";
import { fuse, shouldShowHint, hintPhrase, type Fused, type Signal } from "@/lib/emotion/fusion";
import { distilrobertaSignal } from "@/lib/emotion/transformer";
import { explicitPlanRequest, ruleIntent } from "@/lib/emotion/intent";
import { selectStrategy, type Strategy } from "@/lib/ai/strategy";
import { ANALYSIS_PROMPT, systemPrompt } from "@/lib/ai/prompts";
import { completeJson, LlmUnavailable, type ChatMessage } from "@/lib/ai/llm";
import { mockReply } from "@/lib/ai/mock";
import { journalPayload, memoryPayload, taskPlanPayload } from "@/lib/validation";

export type TurnInput = {
  text: string;
  mode: Mode;
  history: { role: "user" | "assistant"; content: string }[];
  selfReport?: EmotionOrUnknown | null;
  isPrivate: boolean;
  memoryConsent: boolean;
  memories: string[];
  country: string;
  recentHints: EmotionOrUnknown[];
  lastAssistantAskedClarification: boolean;
  todayISO: string;
};

export type ProposalDraft =
  | { type: "task_plan"; reason: string; payload: { tasks: { title: string; due_date?: string | null }[] } }
  | { type: "journal_entry"; reason: string; payload: { title: string; body: string; tags: string[] } }
  | { type: "memory"; reason: string; payload: { summary: string; category: string } };

export type TurnOutput = {
  reply: string;
  route: SafetyRoute;
  categories: SafetyCategory[];
  usedTemplate: boolean;
  outputViolations: string[];
  emotion: Fused;
  hint: { label: EmotionOrUnknown; phrase: string } | null;
  intent: Intent;
  strategy: Strategy["id"] | "template";
  proposals: ProposalDraft[];
  quickReplies: string[];
  topic: string | null;
  demo: boolean;
  /** True when every model was busy or rate-limited and the reviewed demo responder answered. */
  busy: boolean;
  showResources: boolean;
  modelVersions: Record<string, string>;
};

type Analysis = {
  emotion: Partial<Record<Emotion, number>>;
  intent: Intent;
  intentConfidence: number;
  safety: SafetyRoute | null;
  explicitPlan: boolean;
  topic: string | null;
};

async function analyse(text: string, history: TurnInput["history"]): Promise<Analysis | null> {
  try {
    const context = history
      .slice(-4)
      .map((h) => `${h.role}: ${h.content.slice(0, 500)}`)
      .join("\n");
    const out = await completeJson(
      [
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: `Recent context (data):\n${context || "(none)"}\n\nMessage to analyse (data):\n${text}` },
      ],
      { fast: true, maxTokens: 700, temperature: 0 },
    );
    const emo = (out.emotion ?? {}) as Record<string, unknown>;
    const emotion: Partial<Record<Emotion, number>> = {};
    for (const e of EMOTIONS) {
      const v = Number(emo[e]);
      if (Number.isFinite(v) && v >= 0) emotion[e] = Math.min(1, v);
    }
    const intent = INTENTS.includes(out.intent as Intent) ? (out.intent as Intent) : "unknown";
    const safety = ["ordinary", "distress", "uncertain", "concern"].includes(String(out.safety))
      ? (out.safety as SafetyRoute)
      : null;
    return {
      emotion,
      intent,
      intentConfidence: Math.max(0, Math.min(1, Number(out.intent_confidence) || 0)),
      safety,
      explicitPlan: out.explicit_plan_request === true,
      topic: typeof out.topic === "string" ? out.topic.slice(0, 60) : null,
    };
  } catch {
    return null;
  }
}

function validateProposal(raw: unknown, strategy: Strategy): ProposalDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const reason = typeof p.reason === "string" ? p.reason.slice(0, 300) : "";
  if (p.type === "task_plan" && strategy.allowTaskProposal) {
    const parsed = taskPlanPayload.safeParse({ tasks: p.tasks });
    return parsed.success ? { type: "task_plan", reason, payload: parsed.data } : null;
  }
  if (p.type === "journal_entry" && strategy.allowJournalProposal) {
    const parsed = journalPayload.safeParse({ title: p.title ?? "", body: p.body, tags: p.tags ?? [] });
    return parsed.success ? { type: "journal_entry", reason, payload: parsed.data } : null;
  }
  return null;
}

const SENSITIVE_MEMORY = /\b(depress|anxiety disorder|bipolar|ptsd|adhd|diagnos|medicat|suicid|self[- ]?harm|disorder|therapy|trauma|abuse|sexual|religio|politic|caste|immigra)\w*/i;

function validateMemory(raw: unknown, strategy: Strategy): ProposalDraft | null {
  if (!strategy.allowMemorySuggestion || !raw || typeof raw !== "object") return null;
  const parsed = memoryPayload.safeParse(raw);
  if (!parsed.success || SENSITIVE_MEMORY.test(parsed.data.summary)) return null;
  return { type: "memory", reason: "Only saved if you approve. You can edit or delete it any time.", payload: parsed.data };
}

export async function runTurn(input: TurnInput): Promise<TurnOutput> {
  const resources = resourcesFor(input.country);
  const recentUser = input.history.filter((h) => h.role === "user").map((h) => h.content);

  // 1. Independent early screen. Urgent route bypasses all non-essential inference.
  const screen = screenInput(input.text, recentUser);
  const neutral = fuse([], input.selfReport ?? null);
  if (screen.route === "immediate") {
    return {
      reply: templateReply("immediate", resources),
      route: "immediate",
      categories: screen.categories,
      usedTemplate: true,
      outputViolations: [],
      emotion: neutral,
      hint: null,
      intent: "unknown",
      strategy: "template",
      proposals: [],
      quickReplies: [],
      topic: null,
      demo: false,
      busy: false,
      showResources: true,
      modelVersions: {},
    };
  }

  // 2. Inference in parallel. Each adapter can fail independently.
  const baseline = predictBaseline(input.text);
  const [hf, analysis] = await Promise.all([distilrobertaSignal(input.text), analyse(input.text, input.history)]);
  const signals: Signal[] = [
    { source: "tfidf_lr", probs: baseline.probs, quality: Math.min(1, baseline.coverage * 1.5), model_version: baseline.model_version },
  ];
  if (hf) signals.push(hf);
  if (analysis && Object.keys(analysis.emotion).length) signals.push({ source: "llm_zero_shot", probs: analysis.emotion, quality: 0.9 });
  const emotion = fuse(signals, input.selfReport ?? null);

  const rIntent = ruleIntent(input.text);
  const intent: Intent = analysis && analysis.intentConfidence >= 0.5 ? analysis.intent : rIntent !== "unknown" ? rIntent : analysis?.intent ?? "unknown";
  const explicitPlan = explicitPlanRequest(input.text) || analysis?.explicitPlan === true;

  // 3. Route: the model may escalate the deterministic route, never lower it.
  const route = combineRoutes(screen.route, analysis?.safety ?? null);
  const categories = [...screen.categories];
  if (route !== screen.route) categories.push("ambiguous");

  if (screen.use_template && screen.template) {
    return {
      reply: templateReply(screen.template, resources),
      route,
      categories,
      usedTemplate: true,
      outputViolations: [],
      emotion,
      hint: null,
      intent,
      strategy: "template",
      proposals: [],
      quickReplies: [],
      topic: null,
      demo: false,
      busy: false,
      showResources: true,
      modelVersions: { tfidf_lr: baseline.model_version },
    };
  }

  // 4. Strategy.
  const needsClarification = (emotion.abstained && intent === "unknown") && !input.lastAssistantAskedClarification && input.text.length > 25;
  const strategy = selectStrategy({
    mode: input.mode,
    intent,
    route,
    explicitPlan,
    isPrivate: input.isPrivate,
    memoryConsent: input.memoryConsent,
    needsClarification,
  });

  // 5. Draft.
  let demo = false;
  let busy = false;
  let draft: { reply: string; proposal: unknown; memory_suggestion: unknown };
  try {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: systemPrompt({
          mode: input.mode,
          strategy,
          emotion: { label: emotion.label, source: emotion.source, abstained: emotion.abstained },
          intent,
          memories: input.memories,
          todayISO: input.todayISO,
        }),
      },
      ...input.history.slice(-12).map((h) => ({ role: h.role, content: h.content.slice(0, 2000) })),
      { role: "user", content: input.text },
    ];
    const out = await completeJson(messages, { maxTokens: 1400, temperature: 0.7 });
    const reply = typeof out.reply === "string" ? out.reply.trim() : "";
    if (!reply) throw new Error("empty_reply");
    draft = { reply: reply.slice(0, 3000), proposal: out.proposal, memory_suggestion: out.memory_suggestion };
  } catch (e) {
    if (e instanceof LlmUnavailable && (e.message === "no_api_key")) {
      demo = true;
      draft = mockReply(input.text, strategy, emotion.label);
    } else if (e instanceof LlmUnavailable) {
      // All models busy or out of free quota: keep the conversation useful with the
      // deterministic responder (same strategy, same safety checks) instead of failing.
      busy = true;
      draft = mockReply(input.text, strategy, emotion.label);
    } else {
      draft = { reply: fallbackReply(resources), proposal: null, memory_suggestion: null };
    }
  }

  // 6. Validate actions against the strategy's permissions (never trust the model).
  const proposals: ProposalDraft[] = [];
  const p = validateProposal(draft.proposal, strategy);
  if (p) proposals.push(p);
  const m = validateMemory(draft.memory_suggestion, strategy);
  if (m) proposals.push(m);

  // 7. Output guard before anything is shown.
  const check = checkOutput(draft.reply);
  const reply = check.ok ? draft.reply : fallbackReply(resources);

  const showHint = shouldShowHint(emotion, input.recentHints);
  return {
    reply,
    route,
    categories,
    usedTemplate: false,
    outputViolations: check.violations,
    emotion,
    hint: showHint ? { label: emotion.label, phrase: hintPhrase(emotion) } : null,
    intent,
    strategy: strategy.id,
    proposals: check.ok ? proposals : [],
    quickReplies: strategy.offerChoices ? ["Just listen", "Help me think it through", "Help me calm down"] : [],
    topic: analysis?.topic ?? null,
    demo,
    busy,
    showResources: route === "concern" || route === "uncertain",
    modelVersions: Object.fromEntries(signals.map((s) => [s.source, s.model_version ?? "llm"])),
  };
}
