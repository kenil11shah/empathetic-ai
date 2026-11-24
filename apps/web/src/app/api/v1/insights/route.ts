import { json, withAuth } from "@/lib/api";
import { getConsents } from "@/lib/consents";
import { buildInsights, dateRange, distribution, RANGES, type RangeKey } from "@/lib/insights";

function todayIn(tz: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export const GET = withAuth(async (ctx, req) => {
  const r = req.nextUrl.searchParams.get("range") ?? "30d";
  const range: RangeKey = r in RANGES ? (r as RangeKey) : "30d";
  const { data: profile } = await ctx.supabase.from("profiles").select("timezone").eq("id", ctx.user.id).single();
  const today = todayIn(profile?.timezone ?? "UTC");
  const start = dateRange(today, RANGES[range])[0];
  const weekStart = dateRange(today, 7)[0];

  const [{ data: rows }, { data: doneTasks }, { data: wellness }, consents] = await Promise.all([
    ctx.supabase.from("checkins").select("local_date, mood, stress, energy, emotions, tags").eq("user_id", ctx.user.id).gte("local_date", start).lte("local_date", today),
    ctx.supabase.from("tasks").select("title, completed_at").eq("user_id", ctx.user.id).eq("status", "done").gte("completed_at", `${weekStart}T00:00:00Z`),
    ctx.supabase.from("wellness_sessions").select("activity_id, helpful, created_at").eq("user_id", ctx.user.id).gte("created_at", `${weekStart}T00:00:00Z`),
    getConsents(ctx),
  ]);

  const insights = buildInsights(rows ?? [], today, range);

  // Inferred chat emotions are optional, consent-gated and kept separate from self-report.
  let inferred = null;
  if (consents.insights && consents.emotion_history) {
    const { data: ev } = await ctx.supabase
      .from("emotion_events")
      .select("top_label, corrected_label, dismissed")
      .eq("user_id", ctx.user.id)
      .gte("created_at", `${start}T00:00:00Z`);
    const labels = (ev ?? []).filter((e) => !e.dismissed).map((e) => e.corrected_label ?? e.top_label).filter((l) => l && l !== "mixed_unknown");
    inferred = { source: "inferred_from_chat", note: "Tentative model inferences, including your corrections.", distribution: distribution(labels), count: labels.length };
  }

  const weekRows = (rows ?? []).filter((r) => r.local_date >= weekStart);
  const weekly = {
    window: { start: weekStart, end: today },
    checkins: weekRows.length,
    top_tags: distribution(weekRows.flatMap((r) => r.tags ?? []), 3),
    completed_tasks: (doneTasks ?? []).length,
    helpful_activities: distribution((wellness ?? []).filter((w) => w.helpful === "yes").map((w) => w.activity_id), 3),
    prompts: [
      "What is one thing that went okay this week, however small?",
      "What drained your energy, and what gave you some back?",
      "Is there one thing you'd like to do a little differently next week?",
    ],
  };

  return json({ ...insights, inferred, weekly });
});
