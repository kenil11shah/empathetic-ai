import "server-only";
import { serverEnv } from "@/lib/env";

export type Transcript = {
  text: string;
  demo: boolean;
  quality: { duration_s: number | null; confidence: "high" | "medium" | "low"; no_speech: boolean };
  model: string;
};

/**
 * Whisper-compatible transcription. The audio is streamed to the provider and never
 * written to disk or the database by this app.
 */
export async function transcribe(file: File, durationS: number | null): Promise<Transcript> {
  const env = serverEnv().stt;
  if (!env.apiKey) {
    return {
      text: "",
      demo: true,
      quality: { duration_s: durationS, confidence: "low", no_speech: false },
      model: "demo-mode",
    };
  }
  const form = new FormData();
  form.append("file", file, file.name || "recording.webm");
  form.append("model", env.model);
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(`${env.baseUrl.replace(/\/$/, "")}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.apiKey}` },
      body: form,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`transcription_${res.status}`);
    const data = (await res.json()) as {
      text?: string;
      duration?: number;
      segments?: { avg_logprob?: number; no_speech_prob?: number }[];
    };
    const segs = data.segments ?? [];
    const avgProb = segs.length ? segs.reduce((a, s) => a + Math.exp(s.avg_logprob ?? -1), 0) / segs.length : 0.5;
    const noSpeech = segs.length ? segs.every((s) => (s.no_speech_prob ?? 0) > 0.6) : !(data.text ?? "").trim();
    const confidence = noSpeech ? "low" : avgProb > 0.75 ? "high" : avgProb > 0.5 ? "medium" : "low";
    return {
      text: (data.text ?? "").trim(),
      demo: false,
      quality: { duration_s: data.duration ?? durationS, confidence, no_speech: noSpeech },
      model: env.model,
    };
  } finally {
    clearTimeout(timer);
  }
}
