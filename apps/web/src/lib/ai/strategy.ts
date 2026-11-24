/**
 * Deterministic strategy selection. Lives outside the language model so that mode rules,
 * safety overrides and action permissions are enforced in code, not in a prompt.
 */
import type { Intent, Mode } from "@/lib/constants";
import type { SafetyRoute } from "@/lib/safety/policy";

export type StrategyId =
  | "reflective_listening"
  | "socratic_questions"
  | "problem_solving"
  | "realistic_encouragement"
  | "reflection_prompts"
  | "casual_chat"
  | "gentle_grounding"
  | "celebrate"
  | "distress_support"
  | "supportive_clarification";

export type Strategy = {
  id: StrategyId;
  allowTaskProposal: boolean;
  allowJournalProposal: boolean;
  allowMemorySuggestion: boolean;
  askClarification: boolean;
  offerChoices: boolean;
  instructions: string;
};

const MODE_STRATEGY: Record<Mode, StrategyId> = {
  just_listen: "reflective_listening",
  help_me_think: "socratic_questions",
  problem_solver: "problem_solving",
  motivate_me: "realistic_encouragement",
  self_reflection: "reflection_prompts",
  casual: "casual_chat",
  calm_me_down: "gentle_grounding",
};

export const STRATEGY_TEXT: Record<StrategyId, string> = {
  reflective_listening:
    "Listen and reflect. Paraphrase what they said and name feelings tentatively. Do NOT offer advice, solutions or plans unless they explicitly ask. You may end with a soft open question or simply let them continue.",
  socratic_questions:
    "Help them think. Briefly acknowledge, then ask ONE or two open, curious questions that help them untangle the situation. Do not lecture.",
  problem_solving:
    "Acknowledge briefly, then offer 2-3 concrete, realistic options or small next steps. Keep steps tiny and doable. Ask which feels most manageable.",
  realistic_encouragement:
    "Offer warm, realistic encouragement grounded in what they told you. Avoid toxic positivity and empty hype. Point to their effort and one small next step.",
  reflection_prompts:
    "Offer one or two gentle reflection prompts that help them notice patterns, values or needs. Do not interpret or diagnose.",
  casual_chat: "Chat naturally and lightly, like a friendly companion. Keep it short.",
  gentle_grounding:
    "Offer gentle grounding. Suggest ONE simple, optional exercise (for example slow breathing with a longer exhale, or noticing five things you can see). Never require breath-holding. Make it clear they can stop at any time.",
  celebrate: "Celebrate with them warmly and specifically. Ask what made it possible or how they want to mark it.",
  distress_support:
    "They seem to be going through something hard. Acknowledge their feelings first, with warmth and without minimising. Do not rush to fix. Offer a choice of what would help: just listening, thinking it through together, or something calming.",
  supportive_clarification:
    "Some of their words could mean different things and might point to serious distress. Respond with warmth, gently reflect what you heard, and ask one caring, direct question to understand what they mean and how they are doing right now. Mention that talking to someone they trust or a helpline is always an option. Do not panic or lecture.",
};

export function selectStrategy(input: {
  mode: Mode;
  intent: Intent;
  route: SafetyRoute;
  explicitPlan: boolean;
  isPrivate: boolean;
  memoryConsent: boolean;
  needsClarification: boolean;
}): Strategy {
  const { mode, intent, route, explicitPlan, isPrivate, memoryConsent, needsClarification } = input;
  const ordinary = route === "ordinary";

  let id: StrategyId = MODE_STRATEGY[mode];
  if (route === "uncertain") id = "supportive_clarification";
  else if (route === "distress" && mode !== "calm_me_down") id = explicitPlan ? "problem_solving" : "distress_support";
  else if (intent === "celebrate" && mode !== "just_listen") id = "celebrate";
  else if (intent === "calm" && mode !== "just_listen") id = "gentle_grounding";
  else if ((intent === "plan" || explicitPlan) && mode !== "just_listen" && mode !== "casual") id = "problem_solving";
  else if (explicitPlan && mode === "just_listen") id = "problem_solving"; // user explicitly asked

  const plannerMode = mode === "problem_solver" || mode === "help_me_think" || mode === "motivate_me";
  const allowTaskProposal =
    (ordinary || route === "distress") &&
    (explicitPlan || (plannerMode && (intent === "plan" || intent === "seek_advice")));

  return {
    id,
    allowTaskProposal,
    allowJournalProposal: ordinary && !isPrivate && (mode === "self_reflection" || intent === "reflect"),
    allowMemorySuggestion: ordinary && !isPrivate && memoryConsent,
    askClarification: needsClarification && ordinary,
    offerChoices: id === "distress_support",
    instructions: STRATEGY_TEXT[id],
  };
}
