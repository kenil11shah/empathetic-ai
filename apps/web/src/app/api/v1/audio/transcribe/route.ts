import { ApiError, json, withAuth } from "@/lib/api";
import { getConsents } from "@/lib/consents";
import { enforceRateLimit } from "@/lib/ratelimit";
import { transcribe } from "@/lib/ai/transcribe";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel serverless request bodies are capped at ~4.5 MB.
const MAX_SECONDS = 120;
const ALLOWED = /^audio\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|m4a|x-m4a|aac)/;

export const POST = withAuth(async (ctx, req) => {
  const consents = await getConsents(ctx);
  if (!consents.voice_processing) {
    throw new ApiError(403, "consent_required", "Turn on voice transcription in Settings to use voice input.");
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "invalid_audio", "Upload a recording as multipart form data.");
  }
  const file = form.get("file");
  const duration = Number(form.get("duration_s") ?? NaN);
  if (!(file instanceof File)) throw new ApiError(400, "invalid_audio", "No recording was received.");
  if (file.size === 0) throw new ApiError(400, "invalid_audio", "The recording is empty.");
  if (file.size > MAX_BYTES) throw new ApiError(413, "audio_too_large", "That recording is too large. Please keep it under 2 minutes.");
  if (file.type && !ALLOWED.test(file.type)) throw new ApiError(400, "unsupported_audio", "That audio format isn't supported.");
  if (Number.isFinite(duration) && duration < 1) throw new ApiError(400, "audio_too_short", "That recording was too short. Try again.");
  if (Number.isFinite(duration) && duration > MAX_SECONDS + 2) throw new ApiError(400, "audio_too_long", "Recordings can be up to 2 minutes.");

  await enforceRateLimit(ctx, "transcribe");
  try {
    const t = await transcribe(file, Number.isFinite(duration) ? duration : null);
    // Raw audio is discarded here: it is never written to storage or the database.
    return json({
      transcript: t.text,
      demo: t.demo,
      quality: t.quality,
      model: t.model,
      note: t.demo ? "Demo mode: transcription is not configured. Type your message or edit this box." : null,
    });
  } catch {
    throw new ApiError(503, "transcription_unavailable", "Transcription isn't available right now. You can type your message instead.");
  }
});
