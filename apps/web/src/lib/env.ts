// Server-side configuration. Secrets are read only on the server and never sent to the browser.
const pick = (...names: string[]) => {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
};

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

export function serverEnv() {
  const llmKey = pick("LLM_API_KEY", "GROQ_API_KEY");
  const sttKey = pick("TRANSCRIPTION_API_KEY", "GROQ_API_KEY", "LLM_API_KEY");
  return {
    supabaseSecret: pick("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
    llm: {
      apiKey: llmKey,
      baseUrl: pick("LLM_BASE_URL") ?? "https://api.groq.com/openai/v1",
      model: pick("LLM_MODEL") ?? "openai/gpt-oss-120b",
      fastModel: pick("LLM_FAST_MODEL") ?? pick("LLM_MODEL") ?? "openai/gpt-oss-20b",
      // Tried in order when the main model is rate-limited or unavailable. Each Groq model has
      // its own free daily quota, so a chain multiplies the free capacity.
      fallbackModels: (pick("LLM_FALLBACK_MODELS", "LLM_FALLBACK_MODEL") ?? "llama-3.3-70b-versatile,qwen/qwen3-32b,llama-3.1-8b-instant")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      timeoutMs: Number(pick("LLM_TIMEOUT_MS") ?? 25000),
    },
    stt: {
      apiKey: sttKey,
      baseUrl: pick("TRANSCRIPTION_BASE_URL") ?? "https://api.groq.com/openai/v1",
      model: pick("TRANSCRIPTION_MODEL") ?? "whisper-large-v3-turbo",
    },
    hfToken: pick("HF_TOKEN"),
    hfEmotionModel: pick("HF_EMOTION_MODEL") ?? "j-hartmann/emotion-english-distilroberta-base",
    rateLimitPerHour: Number(pick("RATE_LIMIT_PER_HOUR") ?? 40),
    rateLimitPerDay: Number(pick("RATE_LIMIT_PER_DAY") ?? 200),
  };
}

export function demoFlags() {
  const env = serverEnv();
  return {
    llm: !env.llm.apiKey,
    transcription: !env.stt.apiKey,
    transformer: !env.hfToken,
    accountDeletion: !env.supabaseSecret,
  };
}
