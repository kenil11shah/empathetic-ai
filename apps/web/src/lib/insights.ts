/**
 * Self-report analytics. Rules from the PRD: daily means before longer aggregates, never
 * fill missing days with zero, require >= 3 distinct days for trend commentary, show sample
 * counts and time windows, observe rather than explain cause, no single wellbeing score.
 */
export type CheckinRow = {
  local_date: string;
  mood: number;
  stress: number;
  energy: number;
  emotions?: string[] | null;
  tags?: string[] | null;
};

export type DayPoint = { date: string; mood: number | null; stress: number | null; energy: number | null; n: number };

export const RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type RangeKey = keyof typeof RANGES;

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function dateRange(endISO: string, days: number): string[] {
  const [y, m, d] = endISO.split("-").map(Number);
  const end = Date.UTC(y, m - 1, d);
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(new Date(end - i * 86400000).toISOString().slice(0, 10));
  return out;
}

export function dailySeries(rows: CheckinRow[], dates: string[]): DayPoint[] {
  const byDay = new Map<string, CheckinRow[]>();
  for (const r of rows) {
    if (!byDay.has(r.local_date)) byDay.set(r.local_date, []);
    byDay.get(r.local_date)!.push(r);
  }
  return dates.map((date) => {
    const day = byDay.get(date) ?? [];
    const m = mean(day.map((r) => r.mood));
    const s = mean(day.map((r) => r.stress));
    const e = mean(day.map((r) => r.energy));
    return { date, mood: m === null ? null : round1(m), stress: s === null ? null : round1(s), energy: e === null ? null : round1(e), n: day.length };
  });
}

export type Observation = { text: string; sample_days: number; kind: "observation" };

export function observations(series: DayPoint[]): Observation[] {
  const days = series.filter((d) => d.n > 0) as (DayPoint & { mood: number; stress: number; energy: number })[];
  const out: Observation[] = [];
  if (days.length < 3) return out;

  // Mood on lower- vs higher-stress days (split at the median of daily stress means).
  const stresses = [...days.map((d) => d.stress)].sort((a, b) => a - b);
  const median = stresses[Math.floor(stresses.length / 2)];
  const low = days.filter((d) => d.stress < median);
  const high = days.filter((d) => d.stress >= median);
  if (low.length >= 2 && high.length >= 2) {
    const lm = mean(low.map((d) => d.mood))!;
    const hm = mean(high.map((d) => d.mood))!;
    if (Math.abs(lm - hm) >= 0.5) {
      const higherOnLow = lm > hm;
      const supporting = higherOnLow ? low.filter((d) => d.mood > hm).length : low.filter((d) => d.mood < hm).length;
      out.push({
        kind: "observation",
        sample_days: days.length,
        text: `On days you recorded lower stress, your reported mood was generally ${higherOnLow ? "higher" : "lower"} (${supporting} of ${low.length} lower-stress days, average ${round1(lm)} vs ${round1(hm)}). This is an observation, not an explanation of cause.`,
      });
    }
  }

  // Direction of mood between first and second half of the recorded days.
  const half = Math.floor(days.length / 2);
  if (half >= 2) {
    const first = mean(days.slice(0, half).map((d) => d.mood))!;
    const second = mean(days.slice(half).map((d) => d.mood))!;
    if (Math.abs(second - first) >= 0.5) {
      out.push({
        kind: "observation",
        sample_days: days.length,
        text: `Your reported mood in the more recent ${days.length - half} check-in days averaged ${round1(second)}, compared with ${round1(first)} in the earlier ${half}.`,
      });
    }
  }
  return out;
}

export function distribution(values: string[], top = 8) {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([label, count]) => ({ label, count }));
}

export function buildInsights(rows: CheckinRow[], endISO: string, range: RangeKey) {
  const dates = dateRange(endISO, RANGES[range]);
  const inRange = rows.filter((r) => r.local_date >= dates[0] && r.local_date <= endISO);
  const series = dailySeries(inRange, dates);
  const distinctDays = series.filter((d) => d.n > 0).length;
  const averages = {
    mood: mean(series.filter((d) => d.mood !== null).map((d) => d.mood!)),
    stress: mean(series.filter((d) => d.stress !== null).map((d) => d.stress!)),
    energy: mean(series.filter((d) => d.energy !== null).map((d) => d.energy!)),
  };
  return {
    range,
    window: { start: dates[0], end: endISO },
    checkin_count: inRange.length,
    distinct_days: distinctDays,
    sufficient_data: distinctDays >= 3,
    series,
    averages: Object.fromEntries(Object.entries(averages).map(([k, v]) => [k, v === null ? null : round1(v)])),
    observations: observations(series),
    emotions: distribution(inRange.flatMap((r) => r.emotions ?? [])),
    tags: distribution(inRange.flatMap((r) => r.tags ?? []), 6),
    source: "self_report" as const,
  };
}
