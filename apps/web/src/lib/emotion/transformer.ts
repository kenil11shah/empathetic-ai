import "server-only";
import type { Emotion } from "@/lib/constants";
import { serverEnv } from "@/lib/env";
import type { Signal } from "@/lib/emotion/fusion";

// j-hartmann/emotion-english-distilroberta-base labels -> app taxonomy.
const MAP: Record<string, Emotion> = {
  joy: "joy",
  sadness: "sadness",
  anger: "anger",
  disgust: "anger",
  fear: "fear_anxiety",
  neutral: "neutral",
  surprise: "neutral",
};

/**
 * Optional DistilRoBERTa emotion classifier via Hugging Face Inference Providers.
 * Returns null (and the system degrades gracefully) when no token is set, on timeout or
 * on any provider error.
 */
export async function distilrobertaSignal(text: string): Promise<Signal | null> {
  const env = serverEnv();
  if (!env.hfToken) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`https://router.huggingface.co/hf-inference/models/${env.hfEmotionModel}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.hfToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: text.slice(0, 1500), parameters: { top_k: 7 } }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    const rows = (Array.isArray(data) && Array.isArray(data[0]) ? data[0] : data) as { label: string; score: number }[];
    if (!Array.isArray(rows)) return null;
    const probs: Partial<Record<Emotion, number>> = {};
    for (const r of rows) {
      const k = MAP[r.label?.toLowerCase()];
      if (k) probs[k] = (probs[k] ?? 0) + r.score;
    }
    return { source: "distilroberta", probs, quality: 1, model_version: env.hfEmotionModel };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
