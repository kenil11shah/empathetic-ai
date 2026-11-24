/**
 * Weighted late fusion of emotion signals with abstention.
 *
 * Weights come from validation evidence: the TF-IDF baseline's weight is anchored on its
 * measured GoEmotions macro-F1 (see model/text-baseline.metrics.json). The transformer and
 * LLM weights are provisional until they are evaluated on the same held-out split
 * (docs/RESEARCH_BOOK.md, "Evaluation plan"). Equal weights are NOT assumed.
 */
import { EMOTIONS, type Emotion, type EmotionOrUnknown } from "@/lib/constants";

export type Signal = {
  source: "tfidf_lr" | "distilroberta" | "llm_zero_shot";
  probs: Partial<Record<Emotion, number>>;
  quality: number; // 0..1 — input coverage / adapter confidence
  model_version?: string;
};

export const FUSION_WEIGHTS: Record<Signal["source"], number> = {
  tfidf_lr: 0.3,
  distilroberta: 0.45,
  llm_zero_shot: 0.5,
};

export const ABSTAIN_MIN_CONFIDENCE = 0.4;
export const ABSTAIN_MIN_MARGIN = 0.1;

export type Fused = {
  label: EmotionOrUnknown;
  probs: Record<Emotion, number>;
  confidence: number;
  margin: number;
  uncertainty: number; // normalised entropy 0..1
  abstained: boolean;
  disagreement: boolean;
  sources: Signal["source"][];
  source: "inferred" | "self_report";
};

function normalise(p: Partial<Record<Emotion, number>>): Record<Emotion, number> {
  const out = Object.fromEntries(EMOTIONS.map((e) => [e, Math.max(0, p[e] ?? 0)])) as Record<Emotion, number>;
  const s = EMOTIONS.reduce((a, e) => a + out[e], 0);
  if (s <= 0) return Object.fromEntries(EMOTIONS.map((e) => [e, 1 / EMOTIONS.length])) as Record<Emotion, number>;
  for (const e of EMOTIONS) out[e] /= s;
  return out;
}

const argmax = (p: Record<Emotion, number>) => EMOTIONS.reduce((a, b) => (p[b] > p[a] ? b : a));

export function fuse(signals: Signal[], selfReport?: EmotionOrUnknown | null): Fused {
  const usable = signals.filter((s) => s.quality > 0.15);
  const acc = Object.fromEntries(EMOTIONS.map((e) => [e, 0])) as Record<Emotion, number>;
  let total = 0;
  for (const s of usable) {
    const w = FUSION_WEIGHTS[s.source] * s.quality;
    const p = normalise(s.probs);
    for (const e of EMOTIONS) acc[e] += w * p[e];
    total += w;
  }
  const probs = total > 0 ? normalise(acc) : normalise({ neutral: 1 });
  const sorted = [...EMOTIONS].sort((a, b) => probs[b] - probs[a]);
  const confidence = probs[sorted[0]];
  const margin = confidence - probs[sorted[1]];
  const entropy = -EMOTIONS.reduce((a, e) => a + (probs[e] > 0 ? probs[e] * Math.log(probs[e]) : 0), 0);
  const uncertainty = entropy / Math.log(EMOTIONS.length);

  // Disagreement: two confident sources pointing at different, non-neutral labels.
  const confidentTops = usable
    .map((s) => normalise(s.probs))
    .filter((p) => p[argmax(p)] >= 0.5)
    .map(argmax)
    .filter((l) => l !== "neutral");
  const disagreement = new Set(confidentTops).size > 1;

  const abstained = usable.length === 0 || confidence < ABSTAIN_MIN_CONFIDENCE || margin < ABSTAIN_MIN_MARGIN || disagreement;
  const base: Fused = {
    label: abstained ? "mixed_unknown" : sorted[0],
    probs,
    confidence,
    margin,
    uncertainty,
    abstained,
    disagreement,
    sources: usable.map((s) => s.source),
    source: "inferred",
  };
  // A user's own correction is authoritative self-report and always wins.
  if (selfReport) return { ...base, label: selfReport, abstained: false, source: "self_report" };
  return base;
}

/** Only surface a hint when it is useful: not neutral, not abstained, reasonably confident. */
export function shouldShowHint(f: Fused, recentlyShown: EmotionOrUnknown[]): boolean {
  if (f.source === "self_report") return false;
  if (f.abstained || f.label === "neutral" || f.label === "mixed_unknown") return false;
  if (f.confidence < 0.5) return false;
  return !recentlyShown.includes(f.label);
}

/** Tentative wording; never a percentage. */
export function hintPhrase(f: Fused): string {
  return f.confidence >= 0.7 ? "This sounds like it might be" : "This might be";
}
