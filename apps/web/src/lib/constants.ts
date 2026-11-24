export const MODES = [
  "just_listen",
  "help_me_think",
  "problem_solver",
  "motivate_me",
  "self_reflection",
  "casual",
  "calm_me_down",
] as const;
export type Mode = (typeof MODES)[number];

export const MODE_INFO: Record<Mode, { label: string; blurb: string }> = {
  just_listen: { label: "Just Listen", blurb: "Reflects back, no unsolicited advice" },
  help_me_think: { label: "Help Me Think", blurb: "Gentle questions to untangle things" },
  problem_solver: { label: "Problem Solver", blurb: "Options and small next steps" },
  motivate_me: { label: "Motivate Me", blurb: "Realistic encouragement" },
  self_reflection: { label: "Self-Reflection", blurb: "Prompts to explore patterns" },
  casual: { label: "Casual Companion", blurb: "Ordinary, light conversation" },
  calm_me_down: { label: "Calm Me Down", blurb: "Offers gentle grounding" },
};

export const EMOTIONS = ["joy", "sadness", "anger", "fear_anxiety", "frustration", "calm", "neutral"] as const;
export type Emotion = (typeof EMOTIONS)[number];
export type EmotionOrUnknown = Emotion | "mixed_unknown";

export const EMOTION_LABEL: Record<EmotionOrUnknown, string> = {
  joy: "joy",
  sadness: "sadness",
  anger: "anger",
  fear_anxiety: "worry or anxiety",
  frustration: "frustration",
  calm: "calm",
  neutral: "neutral",
  mixed_unknown: "mixed or unclear",
};

export const INTENTS = ["vent", "reflect", "seek_advice", "plan", "celebrate", "calm", "casual", "unknown"] as const;
export type Intent = (typeof INTENTS)[number];

export const CONSENT_TYPES = ["memory", "emotion_history", "insights", "voice_processing", "research"] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export const CONSENT_INFO: Record<ConsentType, { label: string; detail: string }> = {
  memory: {
    label: "Remember things I approve",
    detail: "Lets the assistant save memories you explicitly approve and use them in later chats. Off by default.",
  },
  emotion_history: {
    label: "Keep emotion hints",
    detail: "Stores the tentative emotion hints from chats so you can review and correct them.",
  },
  insights: {
    label: "Show chat-based insights",
    detail: "Includes inferred chat emotions (labelled as inferred) next to your self-reported trends.",
  },
  voice_processing: {
    label: "Voice transcription",
    detail: "Sends recordings to the transcription provider. Raw audio is not stored by this app.",
  },
  research: {
    label: "Research participation",
    detail: "Not used in this prototype. No data is shared for research.",
  },
};

export const COUNTRIES = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "OTHER", name: "Somewhere else" },
] as const;

export const DISCLOSURE_VERSION = "2026-11-24";
export const POLICY_VERSION = "safety-policy-1.0.0";
export const PROPOSAL_TTL_MINUTES = 30;
