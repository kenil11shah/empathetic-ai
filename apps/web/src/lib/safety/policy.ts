/**
 * Independent, deterministic safety policy.
 *
 * Runs OUTSIDE the language model, before any inference and again on every draft reply.
 * The routes below are software routing states, not clinical risk levels. They never use
 * the emotion label: negative emotion is not treated as danger.
 *
 * A language-model safety opinion may ESCALATE a route (see combineRoutes) but can never
 * lower one that this policy produced, and nothing a user types or a mode setting can
 * switch this layer off.
 */
import { POLICY_VERSION } from "@/lib/constants";

export type SafetyRoute = "ordinary" | "distress" | "uncertain" | "concern" | "immediate";
export type SafetyCategory =
  | "self_harm"
  | "self_harm_historical"
  | "method_seeking"
  | "immediacy"
  | "third_party"
  | "harm_to_others"
  | "unsafe_environment"
  | "fiction_or_quote"
  | "distress"
  | "ambiguous"
  | "ambivalent"
  | "prompt_injection";

export type ScreenResult = {
  route: SafetyRoute;
  categories: SafetyCategory[];
  policy_version: string;
  /** True when the reply must come from a reviewed template rather than the model. */
  use_template: boolean;
  template?: "immediate" | "concern" | "third_party" | "harm_to_others" | "unsafe_environment";
};

const RANK: Record<SafetyRoute, number> = { ordinary: 0, distress: 1, uncertain: 2, concern: 3, immediate: 4 };
export const routeRank = (r: SafetyRoute) => RANK[r];
export const maxRoute = (a: SafetyRoute, b: SafetyRoute): SafetyRoute => (RANK[a] >= RANK[b] ? a : b);

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// ---- pattern library -------------------------------------------------------------
const SELF_HARM = [
  /\bkill(ing)? my ?self\b/,
  /\bend(ing)? (my life|it all|everything)\b/,
  /\b(going to|gonna|about to|planning to|plan to|want to|ready to) end it\b(?! with)/,
  /\btake my (own )?life\b/,
  /\bsuicid(e|al)\b/,
  /\b(want|wanted|wanting|going) to die\b/,
  /\bwish i (was|were) dead\b/,
  /\b(don't|do not|dont) want to (live|be alive|exist|wake up)\b/,
  /\bbetter off (dead|without me)\b/,
  /\bhurt(ing)? my ?self\b/,
  /\bself[- ]?harm(ing)?\b/,
  /\bcut(ting)? my ?self\b/,
  /\bno reason to (live|go on)\b/,
  /\bunalive\b/,
  // Hindi / Hinglish (romanised and Devanagari)
  /\b(marna|mar jaana|mar jana) (chahta|chahti|chahte)\b/,
  /\b(khudkushi|aatmahatya|atmahatya)\b/,
  /\bjeena nahi(n)? (chahta|chahti)\b/,
  /आत्महत्या|मरना चाहत|जीना नहीं चाहत|खुद को (मार|नुकसान)/,
];

const IMMEDIACY = [
  /\b(tonight|right now|this evening|in an hour|within the hour)\b/,
  /\b(i have|i've got|got|bought|holding) (the |a |some )?(pills|tablets|rope|gun|knife|blade|razor)\b/,
  /\b(wrote|written|writing) (a|my) (note|goodbye|letter)\b/,
  /\bgoodbye (forever|everyone|world)\b/,
  /\b(i('m| am) )?(going to|gonna|about to|planning to|plan to) (do it|end it|kill my ?self|jump|overdose)\b/,
  /\bi have a plan\b/,
  /\bthis is (the end|my last)\b/,
];

const METHOD_SEEKING = [
  /\bhow (many|much) (pills|tablets|mg|milligrams)\b.*\b(die|kill|overdose|lethal|fatal|end)\b/,
  /\b(painless|easiest|quickest|fastest|best|surest) way to (die|kill my ?self|end (it|my life)|commit suicide)\b/,
  /\blethal (dose|amount)\b/,
  /\bhow (to|do i|can i) (kill my ?self|hang my ?self|overdose|commit suicide|slit)\b/,
  /\bhow deep (to|should i) cut\b/,
];

const THIRD_PARTY = /\b(my|a|our) (friend|best friend|brother|sister|mom|mum|mother|dad|father|partner|boyfriend|girlfriend|husband|wife|roommate|classmate|colleague|coworker|son|daughter|cousin)\b.{0,60}\b(suicid|kill (him|her|them)sel(f|ves)|hurt (him|her|them)sel(f|ves)|self[- ]?harm|wants? to die|end (his|her|their) life)/;

const HARM_OTHERS = /\b(i('m| am)? ?(going to|gonna|want to|will|wanna)|i'll) (kill|hurt|shoot|stab|attack|beat up) (him|her|them|someone|somebody|people|everyone|my \w+)\b/;

const UNSAFE_ENV = [
  /\b(he|she|they|my (partner|husband|wife|boyfriend|girlfriend|dad|father|mom|mother|stepdad|stepmom))\b.{0,30}\b(hits|hit|beats|beat|chokes|choked|threatens|threatened|hurts) me\b/,
  /\bi('m| am) not safe (at home|here|with (him|her|them))\b/,
  /\b(scared|afraid) (he|she|they)('ll| will) (hurt|kill) me\b/,
];

const FICTION = /\b(in (the|a|my) (book|novel|movie|film|show|series|story|game|song|lyrics?|script|play|poem)|my (character|protagonist|story)|fictional|fiction|writing a (story|scene|novel|script|poem)|for (a|my) (class|assignment|essay|research|paper|thesis)|the quote|a quote|lyrics)\b/;

const HISTORICAL = /\b(used to|years ago|months ago|when i was (younger|a kid|a teen|in school|in college)|in the past|back then|last year|a long time ago|no longer|not anymore|anymore)\b/;
const PRESENT = /\b(still|again|lately|these days|recently|right now|now|currently|today|tonight)\b/;

const NEGATORS = /\b(never|not|no|wouldn't|won't|would not|will not|don't|dont|do not|isn't|am not|i'm not|no longer)\b/;
const AMBIVALENT = /\b(not sure|unsure|don't know (if|whether)|dont know (if|whether)|not certain|maybe|kind of|sort of|sometimes)\b/;

const DISTRESS = /\b(overwhelm(ed|ing)|can't cope|cannot cope|hopeless|helpless|panic(king)?|panic attack|breaking down|falling apart|exhausted|burn(ed|t) ?out|can't (take|handle) (it|this|anymore)|so (alone|lonely)|worthless|can't stop crying|crying|anxious|terrified|desperate|can't go on|numb|empty inside|giving up|stressed out|drowning)\b/;

const AMBIGUOUS = /\b(disappear forever|not wake up|sleep forever|be gone|vanish|what's the point|no point (in|to) (anything|living|life)|nothing matters|tired of (living|life|everything|it all)|want it all to stop|can't do this anymore)\b/;

const INJECTION = /\b(ignore (all |your |previous |the )?(instructions|rules|guidelines)|disable (your )?(safety|filter|guardrails)|jailbreak|you are now (dan|unfiltered)|developer mode|system prompt)\b/;

function anyMatch(patterns: RegExp[], text: string) {
  for (const p of patterns) {
    const m = p.exec(text);
    if (m) return m;
  }
  return null;
}

/** Self-harm language that is not negated (e.g. "I would never hurt myself"). */
function selfHarmMatch(text: string): { hit: boolean; ambivalent: boolean } {
  let hit = false;
  let ambivalent = false;
  for (const p of SELF_HARM) {
    const re = new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const before = text.slice(Math.max(0, m.index - 32), m.index);
      const matchText = m[0];
      const selfNegatingPhrase = /^(don't|do not|dont)/.test(matchText);
      if (AMBIVALENT.test(before)) {
        hit = true;
        ambivalent = true;
      } else if (!selfNegatingPhrase && NEGATORS.test(before)) {
        continue; // negated: "I'm not suicidal", "I would never kill myself"
      } else {
        hit = true;
      }
    }
  }
  return { hit, ambivalent };
}

/**
 * Screen a user message. `recent` holds the previous few user messages (oldest first) so
 * that a follow-up like "tonight" after an earlier disclosure is understood in context.
 */
export function screenInput(text: string, recent: string[] = []): ScreenResult {
  const t = normalize(text);
  const prior = recent.slice(-3).map(normalize);
  const categories = new Set<SafetyCategory>();
  let route: SafetyRoute = "ordinary";
  let template: ScreenResult["template"];

  if (INJECTION.test(t)) categories.add("prompt_injection");

  const fiction = FICTION.test(t);
  const methodSeeking = !!anyMatch(METHOD_SEEKING, t);
  const immediacy = !!anyMatch(IMMEDIACY, t);
  const sh = selfHarmMatch(t);
  const priorSelfHarm = prior.some((p) => selfHarmMatch(p).hit && !FICTION.test(p));

  // Method-seeking is a content-policy block regardless of framing (fiction included).
  if (methodSeeking) {
    categories.add("method_seeking");
    route = "immediate";
    template = "immediate";
  }

  if (THIRD_PARTY.test(t)) {
    categories.add("third_party");
    route = maxRoute(route, "concern");
    template ??= "third_party";
  } else if (sh.hit) {
    if (fiction) {
      categories.add("fiction_or_quote");
    } else if (HISTORICAL.test(t) && !PRESENT.test(t)) {
      categories.add("self_harm_historical");
      route = maxRoute(route, "uncertain");
    } else {
      categories.add("self_harm");
      if (sh.ambivalent) categories.add("ambivalent");
      route = maxRoute(route, immediacy ? "immediate" : "concern");
      template ??= immediacy ? "immediate" : "concern";
      if (immediacy) categories.add("immediacy");
    }
  } else if (immediacy && priorSelfHarm) {
    categories.add("immediacy");
    route = "immediate";
    template = "immediate";
  }

  if (HARM_OTHERS.test(t) && !fiction) {
    categories.add("harm_to_others");
    route = maxRoute(route, immediacy ? "immediate" : "concern");
    template ??= "harm_to_others";
  }

  if (anyMatch(UNSAFE_ENV, t)) {
    categories.add("unsafe_environment");
    const now = /\b(right now|tonight|is here|at the door|coming home)\b/.test(t);
    route = maxRoute(route, now ? "immediate" : "concern");
    template ??= now ? "immediate" : "unsafe_environment";
  }

  if (route === "ordinary" || route === "distress") {
    if (AMBIGUOUS.test(t) && !fiction) {
      categories.add("ambiguous");
      route = maxRoute(route, "uncertain");
    } else if (DISTRESS.test(t)) {
      categories.add("distress");
      route = maxRoute(route, "distress");
    }
  }

  return {
    route,
    categories: [...categories],
    policy_version: POLICY_VERSION,
    use_template: route === "immediate" || (route === "concern" && template !== undefined),
    template: route === "immediate" ? "immediate" : route === "concern" ? template : undefined,
  };
}

/**
 * Combine the deterministic route with an optional model opinion. The model can raise
 * "ordinary/distress" to "uncertain" or "concern" but is capped there: only explicit
 * statements caught by the deterministic layer trigger the immediate-danger route.
 */
export function combineRoutes(rule: SafetyRoute, model: SafetyRoute | null | undefined): SafetyRoute {
  if (!model) return rule;
  const capped: SafetyRoute = model === "immediate" ? "concern" : model;
  return maxRoute(rule, capped);
}

// ---- output guard ----------------------------------------------------------------
export type OutputCheck = { ok: boolean; violations: string[] };

const OUTPUT_RULES: { id: string; re: RegExp; negatable?: boolean }[] = [
  { id: "harm_instructions", re: /\b(lethal dose|fatal dose|\d+\s?(mg|milligrams|pills|tablets) (would|will|should|could) (kill|be fatal|be enough))\b/ },
  { id: "harm_instructions", re: /\b(how to|ways to|steps to) (kill yourself|end your life|hurt yourself|self[- ]harm|overdose)\b/, negatable: true },
  { id: "diagnosis", re: /\byou (have|are suffering from|probably have|likely have|might have|seem to have|clearly have) (clinical )?(depression|an? anxiety disorder|bipolar|ptsd|adhd|ocd|bpd|borderline|schizophrenia|an? (mental|personality|eating) disorder)\b/ },
  { id: "medication", re: /\b(you should|try|start|stop|increase|decrease|double) (taking )?(\d+\s?mg|sertraline|fluoxetine|prozac|zoloft|xanax|alprazolam|lexapro|escitalopram|diazepam|valium|lorazepam|melatonin dose|antidepressants?|your medication)\b/ },
  { id: "guarantee", re: /\b(i guarantee|guaranteed to (work|help|fix)|this will (definitely|certainly) (fix|cure|work)|you will definitely feel better|100% (sure|guaranteed))\b/ },
  { id: "attachment", re: /\b(i love you|i('m| am) (in love with you|your (girlfriend|boyfriend|partner|best friend))|only i (understand|can help) you|you don't need anyone else|you only need me)\b/ },
  { id: "monitoring_claim", re: /\bi('m| am| will be) (always )?(watching|monitoring|tracking) (you|over you|your)\b/, negatable: true },
  { id: "human_claim", re: /\bi('m| am) (a )?(human|real person|licensed therapist|therapist|psychologist|doctor|counsel(l)?or)\b/, negatable: true },
  { id: "dispatch_claim", re: /\bi('ve| have)? ?(called|contacted|alerted|notified) (the police|emergency services|911|112|your (family|friend|contact))\b/, negatable: true },
];

export function checkOutput(reply: string): OutputCheck {
  const t = normalize(reply);
  const violations: string[] = [];
  for (const rule of OUTPUT_RULES) {
    const m = rule.re.exec(t);
    if (!m) continue;
    if (rule.negatable) {
      const before = t.slice(Math.max(0, m.index - 20), m.index);
      if (/\b(not|never|n't|can't|cannot|won't|unable to)\s*$/.test(before) || /\b(not|never|n't)\b/.test(before)) continue;
    }
    violations.push(rule.id);
  }
  return { ok: violations.length === 0, violations: [...new Set(violations)] };
}
