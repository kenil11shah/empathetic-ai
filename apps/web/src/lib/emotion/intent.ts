import type { Intent } from "@/lib/constants";

/** Rule-based intent fallback used when the language model is unavailable. */
const RULES: [Intent, RegExp][] = [
  ["plan", /\b(make|help me (make|build)|create|need) (a )?(plan|schedule|to-?do( list)?|checklist)\b|\b(plan|organi[sz]e|break (it|this|that) down|prioriti[sz]e|schedule)\b/i],
  ["seek_advice", /\b(what should i|should i|any advice|what do i do|how (do|can|should) i|what would you|options)\b/i],
  ["vent", /\b(just (need|want) to (vent|talk|rant)|let me vent|listen to me|need to get this off my chest|rant)\b/i],
  ["celebrate", /\b(got the (job|offer)|i passed|i did it|good news|so happy|so excited|nailed it|finally (did|got))\b/i],
  ["calm", /\b(calm( me)? down|panic|can't breathe|help me relax|grounding|breathe)\b/i],
  ["reflect", /\b(why do i|i('ve| have) been thinking|i wonder|pattern|reflect)\b/i],
  ["casual", /^(hi|hey|hello|yo|sup|good (morning|evening|night)|how are you|what's up|thanks|thank you)\b/i],
];

export function ruleIntent(text: string): Intent {
  for (const [intent, re] of RULES) if (re.test(text)) return intent;
  return "unknown";
}

/** Explicit requests for a plan unlock task proposals even in Just Listen mode. */
export function explicitPlanRequest(text: string): boolean {
  return /\b(make|give|create|help me (make|with)|can you (make|do)) (me )?(a )?(plan|to-?do|list of (steps|tasks)|schedule)\b|\b(add|turn) (this|these|that|them) (in)?to (my )?tasks\b|\bbreak (it|this|that) down\b/i.test(
    text,
  );
}
