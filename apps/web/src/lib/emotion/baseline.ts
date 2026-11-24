/**
 * TypeScript runtime for the TF-IDF + Logistic Regression baseline trained in
 * services/ml/train_text_baseline.py. Reproduces sklearn's TfidfVectorizer
 * (lowercase, token pattern \b\w\w+\b, word 1-2 grams, sublinear tf, l2 norm) and the
 * multinomial logistic regression, then applies temperature scaling.
 */
import model from "./model/text-baseline.json";
import type { Emotion } from "@/lib/constants";

type Model = {
  model_version: string;
  classes: Emotion[];
  features: string[];
  idf: number[];
  coef: number[][];
  intercept: number[];
  temperature: number;
};

const M = model as unknown as Model;
const INDEX = new Map<string, number>(M.features.map((f, i) => [f, i]));
const TOKEN = /[\p{L}\p{N}_]{2,}/gu;

export const BASELINE_VERSION = M.model_version;

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN) ?? [];
}

export function vectorize(text: string): Map<number, number> {
  const toks = tokenize(text);
  const grams: string[] = [...toks];
  for (let i = 0; i < toks.length - 1; i++) grams.push(`${toks[i]} ${toks[i + 1]}`);
  const tf = new Map<number, number>();
  for (const g of grams) {
    const idx = INDEX.get(g);
    if (idx !== undefined) tf.set(idx, (tf.get(idx) ?? 0) + 1);
  }
  let norm = 0;
  const vec = new Map<number, number>();
  for (const [idx, count] of tf) {
    const v = (1 + Math.log(count)) * M.idf[idx];
    vec.set(idx, v);
    norm += v * v;
  }
  norm = Math.sqrt(norm);
  if (norm > 0) for (const [k, v] of vec) vec.set(k, v / norm);
  return vec;
}

export function softmax(z: number[]) {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

export type BaselineResult = {
  probs: Record<Emotion, number>;
  coverage: number; // share of tokens the model recognises — low coverage means low quality
  model_version: string;
};

export function predictBaseline(text: string): BaselineResult {
  const vec = vectorize(text);
  const logits = M.coef.map((row, c) => {
    let s = M.intercept[c];
    for (const [idx, v] of vec) s += row[idx] * v;
    return s / M.temperature;
  });
  const p = softmax(logits);
  const probs = Object.fromEntries(M.classes.map((c, i) => [c, p[i]])) as Record<Emotion, number>;
  const toks = tokenize(text);
  const known = toks.filter((t) => INDEX.has(t)).length;
  return { probs, coverage: toks.length ? known / toks.length : 0, model_version: M.model_version };
}
