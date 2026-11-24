"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, X } from "lucide-react";
import { Bars, LineChart } from "@/components/charts";
import { Badge, Card, EmptyState, ErrorNote, PageHeader, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/client-api";
import { EMOTION_LABEL, type EmotionOrUnknown } from "@/lib/constants";
import { ACTIVITIES } from "@/lib/wellness";

type Insights = {
  range: string;
  window: { start: string; end: string };
  checkin_count: number;
  distinct_days: number;
  sufficient_data: boolean;
  series: { date: string; mood: number | null; stress: number | null; energy: number | null; n: number }[];
  averages: { mood: number | null; stress: number | null; energy: number | null };
  observations: { text: string; sample_days: number }[];
  emotions: { label: string; count: number }[];
  tags: { label: string; count: number }[];
  inferred: { note: string; distribution: { label: string; count: number }[]; count: number } | null;
  weekly: { window: { start: string; end: string }; checkins: number; top_tags: { label: string; count: number }[]; completed_tasks: number; helpful_activities: { label: string; count: number }[]; prompts: string[] };
};

export default function InsightsPage() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weeklyHidden, setWeeklyHidden] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setData(null);
    try {
      setData(await api<Insights>(`/insights?range=${range}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [range]);
  useEffect(() => { void load(); }, [load]);

  const emoLabel = (l: string) => EMOTION_LABEL[l as EmotionOrUnknown] ?? l;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        title="Insights"
        subtitle="Patterns from what you've reported in check-ins. Observations, not explanations, and never a score."
        actions={
          <div role="tablist" className="flex rounded-full bg-surface p-1">
            {(["7d", "30d", "90d"] as const).map((r) => (
              <button key={r} role="tab" aria-selected={range === r} onClick={() => setRange(r)} className={cx("rounded-full px-3 py-1.5 text-sm font-medium", range === r ? "bg-ink text-white" : "text-ink-soft")}>
                {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
              </button>
            ))}
          </div>
        }
      />
      {error && <ErrorNote message={error} onRetry={load} />}
      {!data ? (
        <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">{data.window.start} to {data.window.end} · {data.checkin_count} check-ins on {data.distinct_days} days · source: your self-reports</p>

          {!data.sufficient_data ? (
            <EmptyState icon={<BarChart3 className="size-8" />} title="Not enough check-ins yet" action={<div className="flex flex-wrap justify-center gap-3"><Link href="/app/checkins" className="font-medium text-teal underline">Add a check-in</Link><button className="font-medium text-ink-soft underline" onClick={async () => { await api("/sample-data", { method: "POST" }).catch(() => {}); void load(); }}>Explore with sample data</button></div>}>
              Trends appear once you have check-ins on at least 3 different days in this range. Missing days are shown as gaps, never as zero.
            </EmptyState>
          ) : (
            <>
              {data.observations.length > 0 && (
                <Card>
                  <h2 className="font-sans text-lg font-semibold">Observations</h2>
                  <ul className="mt-2 space-y-2">
                    {data.observations.map((o) => <li key={o.text} className="text-ink-soft">{o.text} <span className="text-xs text-muted">(based on {o.sample_days} days)</span></li>)}
                  </ul>
                </Card>
              )}
              <Card className="space-y-6">
                <LineChart title="Mood" unit="out of 5" min={1} max={5} color="#187B70" points={data.series.map((d) => ({ date: d.date, value: d.mood }))} />
                <LineChart title="Stress" unit="out of 10" min={1} max={10} color="#4A6560" points={data.series.map((d) => ({ date: d.date, value: d.stress }))} />
                <LineChart title="Energy" unit="out of 10" min={1} max={10} color="#8A6A3D" points={data.series.map((d) => ({ date: d.date, value: d.energy }))} />
                <p className="text-xs text-muted">Each point is the average of that day&apos;s check-ins. Averages for the range: mood {data.averages.mood ?? "–"}, stress {data.averages.stress ?? "–"}, energy {data.averages.energy ?? "–"}.</p>
              </Card>
            </>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="font-sans text-lg font-semibold">Feelings you selected</h2>
              <p className="text-xs text-muted">From check-ins (self-reported)</p>
              <div className="mt-3">{data.emotions.length ? <Bars label="Feelings you selected" items={data.emotions.map((e) => ({ ...e, label: emoLabel(e.label) }))} /> : <p className="text-sm text-ink-soft">None selected in this range.</p>}</div>
            </Card>
            <Card>
              <h2 className="font-sans text-lg font-semibold">Recurring tags</h2>
              <p className="text-xs text-muted">Tags you added</p>
              <div className="mt-3">{data.tags.length ? <Bars label="Recurring tags" items={data.tags.map((t) => ({ ...t, label: `#${t.label}` }))} /> : <p className="text-sm text-ink-soft">No tags yet.</p>}</div>
            </Card>
          </div>

          {data.inferred && (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-sans text-lg font-semibold">Emotion hints from chats</h2>
                <Badge tone="sand">Inferred, not self-reported</Badge>
              </div>
              <p className="text-xs text-muted">{data.inferred.note} {data.inferred.count} hints in this range.</p>
              <div className="mt-3">{data.inferred.distribution.length ? <Bars label="Inferred emotion hints" items={data.inferred.distribution.map((e) => ({ ...e, label: emoLabel(e.label) }))} /> : <p className="text-sm text-ink-soft">No hints in this range.</p>}</div>
            </Card>
          )}

          {!weeklyHidden && (
            <Card className="bg-teal-soft/40">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-sans text-lg font-semibold">Your week in reflection</h2>
                  <p className="text-xs text-muted">{data.weekly.window.start} to {data.weekly.window.end} · from your own records</p>
                </div>
                <button onClick={() => setWeeklyHidden(true)} aria-label="Dismiss weekly reflection" className="rounded-full p-1 hover:bg-surface"><X className="size-4" /></button>
              </div>
              <ul className="mt-3 space-y-1 text-ink-soft">
                <li>{data.weekly.checkins} check-in{data.weekly.checkins === 1 ? "" : "s"} this week{data.weekly.top_tags.length ? `, often tagged ${data.weekly.top_tags.map((t) => `#${t.label}`).join(", ")}` : ""}.</li>
                <li>{data.weekly.completed_tasks} task{data.weekly.completed_tasks === 1 ? "" : "s"} completed.</li>
                {data.weekly.helpful_activities.length > 0 && <li>Activities you found helpful: {data.weekly.helpful_activities.map((a) => ACTIVITIES.find((x) => x.id === a.label)?.title ?? a.label).join(", ")}.</li>}
              </ul>
              <h3 className="mt-4 font-sans text-sm font-semibold">Prompts to sit with</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-soft">{data.weekly.prompts.map((p) => <li key={p}>{p}</li>)}</ul>
              <Link href="/app/journal" className="mt-3 inline-block text-sm font-medium text-teal underline">Write in your journal</Link>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
