import { audit, withAuth } from "@/lib/api";

const TABLES = [
  "profiles", "consents", "chat_sessions", "messages", "emotion_events", "session_feedback", "memories",
  "checkins", "journal_entries", "proposals", "tasks", "wellness_sessions", "safety_plans", "trusted_contacts",
] as const;

function readable(data: Record<string, Record<string, unknown>[]>) {
  const lines: string[] = ["EMPATHETIC AI — DATA EXPORT", `Generated ${new Date().toISOString()}`, ""];
  lines.push("== Journal ==");
  for (const j of data.journal_entries ?? []) lines.push(`[${j.entry_date}] ${j.title || "(untitled)"}\n${j.body}\n`);
  lines.push("== Check-ins ==");
  for (const c of data.checkins ?? []) lines.push(`${c.local_date}: mood ${c.mood}/5, stress ${c.stress}/10, energy ${c.energy}/10${c.notes ? ` — ${c.notes}` : ""}`);
  lines.push("", "== Tasks ==");
  for (const t of data.tasks ?? []) lines.push(`[${t.status === "done" ? "x" : " "}] ${t.title}`);
  lines.push("", "== Memories ==");
  for (const m of data.memories ?? []) lines.push(`- ${m.summary}`);
  lines.push("", "== Conversations ==");
  const bySession = new Map<string, Record<string, unknown>[]>();
  for (const m of data.messages ?? []) {
    const k = String(m.session_id);
    if (!bySession.has(k)) bySession.set(k, []);
    bySession.get(k)!.push(m);
  }
  for (const s of data.chat_sessions ?? []) {
    lines.push(`--- ${s.title} ---`);
    for (const m of bySession.get(String(s.id)) ?? []) lines.push(`${m.role === "user" ? "You" : "AI"}: ${m.content}`);
    lines.push("");
  }
  return lines.join("\n");
}

export const POST = withAuth(async (ctx, req) => {
  const format = req.nextUrl.searchParams.get("format") === "text" ? "text" : "json";
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const t of TABLES) {
    const col = t === "profiles" ? "id" : "user_id";
    const { data: rows } = await ctx.supabase.from(t).select("*").eq(col, ctx.user.id);
    data[t] = rows ?? [];
  }
  await audit(ctx, "export", "account", ctx.user.id);
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "text") {
    return new Response(readable(data), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="empathetic-ai-export-${stamp}.txt"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(JSON.stringify({ exported_at: new Date().toISOString(), user_id: ctx.user.id, data }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="empathetic-ai-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
