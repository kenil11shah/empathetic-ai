import "server-only";
import { serverEnv } from "@/lib/env";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class LlmUnavailable extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(model: string, messages: ChatMessage[], opts: { maxTokens: number; temperature: number }) {
  const env = serverEnv().llm;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), env.timeoutMs);
  try {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: opts.temperature,
      max_completion_tokens: opts.maxTokens,
      response_format: { type: "json_object" },
    };
    if (model.startsWith("openai/gpt-oss")) body.reasoning_effort = "low";
    if (model.startsWith("qwen/")) body.reasoning_format = "hidden";
    const res = await fetch(`${env.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Extract the first JSON object from a model reply, tolerating code fences. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const v = JSON.parse(cleaned);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * OpenAI-compatible JSON completion with a bounded retry (jittered) for 429/5xx and a
 * one-time fallback model if the configured model is unavailable. Works with Groq,
 * OpenRouter, OpenAI and Gemini's OpenAI-compatible endpoint.
 */
export async function completeJson(
  messages: ChatMessage[],
  opts: { fast?: boolean; maxTokens?: number; temperature?: number } = {},
): Promise<Record<string, unknown>> {
  const env = serverEnv().llm;
  if (!env.apiKey) throw new LlmUnavailable("no_api_key");
  const models = [opts.fast ? env.fastModel : env.model, ...env.fallbackModels].filter(
    (m, i, arr) => m && arr.indexOf(m) === i,
  );
  const o = { maxTokens: opts.maxTokens ?? 1200, temperature: opts.temperature ?? 0.6 };

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await call(model, messages, o);
      } catch {
        if (attempt === 0) {
          await sleep(300 + Math.random() * 500);
          continue;
        }
        break;
      }
      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const parsed = parseJsonObject(data.choices?.[0]?.message?.content ?? "");
        if (parsed) return parsed;
        if (attempt === 0) continue;
        break;
      }
      if (res.status === 429) break; // this model's free quota is used up: move to the next model
      if (res.status >= 500) {
        if (attempt === 0) {
          await sleep(400 + Math.random() * 800);
          continue;
        }
        break;
      }
      // 400/404: model not available or bad request -> try the fallback model.
      break;
    }
  }
  throw new LlmUnavailable("provider_failed");
}
