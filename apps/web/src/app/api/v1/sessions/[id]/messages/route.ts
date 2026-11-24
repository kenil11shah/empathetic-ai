import { ApiError, dbError, json, parseBody, withAuth } from "@/lib/api";
import { getConsents } from "@/lib/consents";
import { PROPOSAL_TTL_MINUTES, type EmotionOrUnknown } from "@/lib/constants";
import { runTurn } from "@/lib/ai/orchestrator";
import { selectMemories } from "@/lib/memory";
import { enforceRateLimit } from "@/lib/ratelimit";
import { resourcesFor } from "@/lib/safety/resources";
import { messageCreate } from "@/lib/validation";

const PROPOSAL_PREVIEW: Record<string, string> = {
  task_plan: "Add these tasks to your task list",
  journal_entry: "Save this as a journal entry",
  memory: "Remember this for future conversations",
};

/**
 * POST /v1/sessions/{id}/messages — one conversational turn.
 * `id = "private"` runs a private turn: nothing about the conversation is stored
 * (no message rows, no emotion events, no memory); the client sends recent history.
 */
export const POST = withAuth(async (ctx, req, { id }) => {
  const body = await parseBody(req, messageCreate);
  const isPrivate = id === "private";

  const { data: profile } = await ctx.supabase.from("profiles").select("country, onboarded_at").eq("id", ctx.user.id).single();
  if (!profile?.onboarded_at) throw new ApiError(403, "onboarding_required", "Please finish onboarding first.");

  let history: { role: "user" | "assistant"; content: string }[] = [];
  let recentHints: EmotionOrUnknown[] = [];
  let lastAssistantAskedClarification = false;
  let isFirstMessage = false;

  if (!isPrivate) {
    const { data: session, error } = await ctx.supabase
      .from("chat_sessions")
      .select("id, title")
      .eq("id", id)
      .eq("user_id", ctx.user.id)
      .single();
    dbError(error, "conversation");
    if (!session) throw new ApiError(404, "not_found", "That conversation was not found.");

    // Idempotency: a retried request returns the original reply instead of duplicating it.
    const { data: existing } = await ctx.supabase
      .from("messages")
      .select("id, role, content, meta, safety_route, created_at")
      .eq("session_id", id)
      .eq("request_id", body.request_id);
    const prevAssistant = existing?.find((m) => m.role === "assistant");
    if (prevAssistant) {
      return json({ replayed: true, message: prevAssistant, ...(prevAssistant.meta as object) });
    }

    const { data: past } = await ctx.supabase
      .from("messages")
      .select("role, content, meta")
      .eq("session_id", id)
      .order("created_at", { ascending: false })
      .limit(12);
    const ordered = (past ?? []).reverse();
    history = ordered.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    recentHints = ordered
      .slice(-4)
      .map((m) => (m.meta as { hint?: { label?: EmotionOrUnknown } })?.hint?.label)
      .filter(Boolean) as EmotionOrUnknown[];
    const lastA = [...ordered].reverse().find((m) => m.role === "assistant");
    lastAssistantAskedClarification = !!(lastA?.meta as { asked_clarification?: boolean })?.asked_clarification;
    isFirstMessage = ordered.length === 0 && session.title === "New conversation";
  } else {
    history = (body.history ?? []).slice(-12);
  }

  await enforceRateLimit(ctx, "message");

  const consents = await getConsents(ctx);
  let memories: string[] = [];
  if (consents.memory && !isPrivate) {
    const { data: mem } = await ctx.supabase
      .from("memories")
      .select("id, summary, updated_at, expires_at")
      .eq("user_id", ctx.user.id)
      .order("updated_at", { ascending: false })
      .limit(50);
    memories = selectMemories(mem ?? [], body.text).map((m) => m.summary);
  }

  const out = await runTurn({
    text: body.text,
    mode: body.mode,
    history,
    selfReport: body.self_report ?? null,
    isPrivate,
    memoryConsent: consents.memory,
    memories,
    country: profile.country ?? "OTHER",
    recentHints,
    lastAssistantAskedClarification,
    todayISO: new Date().toISOString().slice(0, 10),
  });

  // Content-free safety telemetry for any non-ordinary route or output-guard trip.
  if (out.route !== "ordinary" || out.categories.length) {
    await ctx.supabase.from("safety_events").insert({
      user_id: ctx.user.id,
      stage: "input",
      route: out.route,
      categories: out.categories,
      policy_version: "safety-policy-1.0.0",
      outcome: out.usedTemplate ? "reviewed_template" : "model_with_policy",
    });
  }
  if (out.outputViolations.length) {
    await ctx.supabase.from("safety_events").insert({
      user_id: ctx.user.id,
      stage: "output",
      route: out.route,
      categories: out.outputViolations,
      policy_version: "safety-policy-1.0.0",
      outcome: "blocked_fallback",
    });
  }

  const meta = {
    hint: out.hint,
    route: out.route,
    show_resources: out.showResources,
    quick_replies: out.quickReplies,
    demo: out.demo,
    busy: out.busy,
    strategy: out.strategy,
    intent: out.intent,
    asked_clarification: /\?\s*$/.test(out.reply) && out.strategy !== "template",
  };

  let userMessageId: string | null = null;
  let assistantMessage: Record<string, unknown> = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: out.reply,
    created_at: new Date().toISOString(),
  };
  let emotionEventId: string | null = null;

  if (!isPrivate) {
    const { data: um, error: uErr } = await ctx.supabase
      .from("messages")
      .insert({
        session_id: id,
        user_id: ctx.user.id,
        role: "user",
        content: body.text,
        request_id: body.request_id,
        safety_route: out.route,
        meta: { input: body.input },
      })
      .select("id")
      .single();
    if (uErr?.code === "23505") throw new ApiError(409, "duplicate", "This message is already being processed.");
    dbError(uErr, "message");
    userMessageId = um!.id;

    if (consents.emotion_history && out.route !== "immediate") {
      const { data: ev } = await ctx.supabase
        .from("emotion_events")
        .insert({
          user_id: ctx.user.id,
          message_id: userMessageId,
          source: out.emotion.source,
          modality: body.input === "voice" ? "voice_transcript" : "text",
          labels: out.emotion.probs,
          top_label: out.emotion.label,
          uncertainty: Number(out.emotion.uncertainty.toFixed(3)),
          quality: { sources: out.emotion.sources, abstained: out.emotion.abstained, disagreement: out.emotion.disagreement },
          inferred_intent: out.intent,
          model_version: Object.entries(out.modelVersions).map(([k, v]) => `${k}:${v}`).join(","),
        })
        .select("id")
        .single();
      emotionEventId = ev?.id ?? null;
    }

    const { data: am, error: aErr } = await ctx.supabase
      .from("messages")
      .insert({
        session_id: id,
        user_id: ctx.user.id,
        role: "assistant",
        content: out.reply,
        request_id: body.request_id,
        safety_route: out.route,
        meta: { ...meta, emotion_event_id: emotionEventId, user_message_id: userMessageId },
      })
      .select("id, role, content, created_at")
      .single();
    dbError(aErr, "message");
    assistantMessage = am!;

    const patch: Record<string, string> = { updated_at: new Date().toISOString() };
    if (isFirstMessage && out.topic) patch.title = out.topic;
    if (body.mode) patch.mode = body.mode;
    await ctx.supabase.from("chat_sessions").update(patch).eq("id", id);
  }

  // Proposals are stored as pending; nothing executes until the user approves.
  const proposals = [];
  for (const [i, p] of out.proposals.entries()) {
    const { data, error } = await ctx.supabase
      .from("proposals")
      .insert({
        user_id: ctx.user.id,
        session_id: isPrivate ? null : id,
        type: p.type,
        preview: PROPOSAL_PREVIEW[p.type],
        reason: p.reason,
        payload: p.payload,
        idempotency_key: `${ctx.user.id}:${body.request_id}:${i}`,
        expires_at: new Date(Date.now() + PROPOSAL_TTL_MINUTES * 60_000).toISOString(),
      })
      .select("id, type, preview, reason, payload, status, expires_at, created_at")
      .single();
    if (!error && data) proposals.push(data);
  }

  const showHelp = out.showResources || out.route === "immediate";
  let trustedContacts: unknown[] = [];
  if (showHelp) {
    const { data: tc } = await ctx.supabase
      .from("trusted_contacts")
      .select("id, name, email, phone, relationship")
      .eq("user_id", ctx.user.id)
      .order("created_at");
    trustedContacts = tc ?? [];
  }

  return json({
    message: assistantMessage,
    trusted_contacts: trustedContacts,
    user_message_id: userMessageId,
    emotion_event_id: emotionEventId,
    proposals,
    resources: out.showResources || out.route === "immediate" ? resourcesFor(profile.country) : null,
    ...meta,
  });
});
