"use client";
import { useEffect, useRef, useState } from "react";
import { Clock, Pause, Play, Square } from "lucide-react";
import { Button, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/client-api";
import { ACTIVITIES, type Activity } from "@/lib/wellness";

export default function WellnessPage() {
  const [active, setActive] = useState<Activity | null>(null);
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      {active ? (
        <Session activity={active} onExit={() => setActive(null)} />
      ) : (
        <>
          <PageHeader title="Wellness" subtitle="Short, optional activities. Stop any time. There's no right way to do them." />
          <div className="grid gap-4 sm:grid-cols-2">
            {ACTIVITIES.map((a) => (
              <Card key={a.id} as="article">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-sans text-lg font-semibold">{a.title}</h2>
                  <span className="inline-flex items-center gap-1 text-xs text-muted"><Clock className="size-3.5" aria-hidden /> ~{a.minutes} min</span>
                </div>
                <p className="mt-1 text-ink-soft">{a.summary}</p>
                <Button className="mt-4" variant="soft" onClick={() => setActive(a)}>Begin</Button>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted">These are general well-being activities, not treatment. If an activity feels uncomfortable, stop and try something else.</p>
        </>
      )}
    </div>
  );
}

function Session({ activity, onExit }: { activity: Activity; onExit: () => void }) {
  const total = activity.minutes * 60;
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [saved, setSaved] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    ref.current = setInterval(() => setElapsed((e) => {
      if (e + 1 >= total) {
        setRunning(false);
        setFinished(true);
        return total;
      }
      return e + 1;
    }), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running, total]);

  const stop = () => {
    if (ref.current) clearInterval(ref.current);
    setRunning(false);
    setFinished(true);
  };

  const record = async (helpful: "yes" | "somewhat" | "no" | null) => {
    try {
      await api("/wellness-sessions", { method: "POST", json: { activity_id: activity.id, duration_seconds: elapsed, completed: elapsed >= total, helpful } });
    } catch {
      // Recording is optional; never block the user on it.
    }
    setSaved(true);
  };

  const left = total - elapsed;
  return (
    <div>
      <Button variant="ghost" onClick={() => { stop(); onExit(); }}>← All activities</Button>
      <Card className="mx-auto mt-4 max-w-xl text-center">
        <h1 className="text-2xl font-semibold">{activity.title}</h1>
        <p className="mt-1 text-ink-soft">{activity.summary}</p>

        {activity.id === "paced-breathing" && (
          <div className="mx-auto my-8 grid size-48 place-items-center">
            <div className={`grid size-44 place-items-center rounded-full bg-teal-soft ${running ? "breathe" : ""}`}>
              <span className="text-sm font-medium text-teal-dark">{running ? "in… and slowly out" : "ready"}</span>
            </div>
          </div>
        )}

        <ol className="mx-auto mt-6 max-w-md space-y-2 text-left">
          {activity.steps.map((s, i) => <li key={i} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-teal-soft text-xs font-semibold text-teal-dark">{i + 1}</span><span>{s}</span></li>)}
        </ol>
        <p className="mt-4 text-sm text-muted">{activity.accessibility}</p>

        <p className="mt-6 font-mono text-3xl tabular-nums" aria-live="off">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</p>

        {!finished ? (
          <div className="mt-4 flex justify-center gap-2">
            {running ? (
              <Button variant="secondary" onClick={() => setRunning(false)}><Pause className="size-4" aria-hidden /> Pause</Button>
            ) : (
              <Button onClick={() => setRunning(true)}><Play className="size-4" aria-hidden /> {elapsed ? "Resume" : "Start"}</Button>
            )}
            <Button variant="ghost" onClick={stop}><Square className="size-4" aria-hidden /> Stop</Button>
          </div>
        ) : saved ? (
          <div className="mt-4">
            <p className="text-ink-soft">Thanks. Take whatever you need from here.</p>
            <Button className="mt-3" variant="secondary" onClick={onExit}>Try another activity</Button>
          </div>
        ) : (
          <div className="mt-4">
            <p className="font-medium">Did this help?</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="soft" onClick={() => record("yes")}>Yes</Button>
              <Button size="sm" variant="soft" onClick={() => record("somewhat")}>Somewhat</Button>
              <Button size="sm" variant="soft" onClick={() => record("no")}>Not really</Button>
              <Button size="sm" variant="ghost" onClick={() => record(null)}>Skip</Button>
            </div>
            <p className="mt-3 text-xs text-muted">If it didn&apos;t feel right, a different activity might suit you better.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
