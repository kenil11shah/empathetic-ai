"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button, ErrorNote } from "@/components/ui";

const MAX_SECONDS = 120;

type Result = { transcript: string; demo: boolean; note: string | null; quality: { confidence: string; no_speech: boolean } };

function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

/**
 * Explicit start/stop/cancel recording with a visible timer. Audio is uploaded once for
 * transcription and discarded; the user always reviews and edits the transcript before sending.
 */
export function Recorder({ onTranscript, onCancel }: { onTranscript: (text: string, info: { demo: boolean; note: string | null; lowConfidence: boolean }) => void; onCancel: () => void }) {
  const [state, setState] = useState<"idle" | "asking" | "recording" | "uploading">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = () => {
    if (timer.current) clearInterval(timer.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => () => cleanup(), []);

  const upload = async (blob: Blob, duration: number) => {
    setState("uploading");
    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    const form = new FormData();
    form.append("file", new File([blob], `recording.${ext}`, { type: blob.type.split(";")[0] || "audio/webm" }));
    form.append("duration_s", String(duration));
    try {
      const res = await fetch("/api/v1/audio/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Transcription failed.");
      const r = data as Result;
      onTranscript(r.transcript, { demo: r.demo, note: r.note, lowConfidence: r.quality.confidence === "low" || r.quality.no_speech });
    } catch (e) {
      setError(`${(e as Error).message} You can type your message instead.`);
      setState("idle");
    }
  };

  const start = async () => {
    setError(null);
    const mime = pickMime();
    if (mime === null || !navigator.mediaDevices?.getUserMedia) {
      setError("Voice recording isn't supported in this browser. You can type instead.");
      return;
    }
    setState("asking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
      chunks.current = [];
      cancelled.current = false;
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        cleanup();
        const duration = (Date.now() - startedAt.current) / 1000;
        if (cancelled.current) {
          chunks.current = [];
          return;
        }
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        chunks.current = [];
        if (duration < 1) {
          setError("That was too short. Try holding on a little longer.");
          setState("idle");
          return;
        }
        void upload(blob, Math.round(duration * 10) / 10);
      };
      recRef.current = rec;
      rec.start(1000);
      startedAt.current = Date.now();
      setSeconds(0);
      setState("recording");
      timer.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAt.current) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS) recRef.current?.stop();
      }, 250);
    } catch {
      cleanup();
      setState("idle");
      setError("Microphone access was blocked. You can allow it in your browser settings, or type instead.");
    }
  };

  const stop = () => recRef.current?.state === "recording" && recRef.current.stop();
  const cancel = () => {
    cancelled.current = true;
    if (recRef.current?.state === "recording") recRef.current.stop();
    cleanup();
    onCancel();
  };

  const mm = String(Math.floor(seconds / 60)).padStart(1, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 py-4">
        <div className={`grid size-20 place-items-center rounded-full ${state === "recording" ? "bg-rose-soft text-rose-ink" : "bg-teal-soft text-teal"}`}>
          <Mic className={`size-8 ${state === "recording" ? "animate-pulse" : ""}`} aria-hidden />
        </div>
        <p className="font-mono text-2xl tabular-nums" aria-live="polite">{mm}:{ss}</p>
        <p className="text-sm text-ink-soft">
          {state === "idle" && "Press start when you're ready. Up to 2 minutes."}
          {state === "asking" && "Waiting for microphone permission…"}
          {state === "recording" && "Recording. Press stop when you're done."}
          {state === "uploading" && "Transcribing…"}
        </p>
      </div>
      {error && <ErrorNote message={error} />}
      <div className="flex justify-center gap-2">
        {state === "recording" ? (
          <Button onClick={stop}><Square className="size-4" aria-hidden /> Stop</Button>
        ) : (
          <Button onClick={start} loading={state === "asking" || state === "uploading"}><Mic className="size-4" aria-hidden /> Start recording</Button>
        )}
        <Button variant="ghost" onClick={cancel} disabled={state === "uploading"}>Cancel</Button>
      </div>
      <p className="text-center text-xs text-muted">You&apos;ll see and can edit the transcript before anything is sent. Recordings aren&apos;t stored.</p>
    </div>
  );
}
