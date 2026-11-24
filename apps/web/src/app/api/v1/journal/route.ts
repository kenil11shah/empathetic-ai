import { dbError, json, parseBody, withAuth } from "@/lib/api";
import { journalBody } from "@/lib/validation";

export const GET = withAuth(async (ctx, req) => {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  let query = ctx.supabase
    .from("journal_entries")
    .select("id, title, body, tags, entry_date, source_kind, ai_summary, ai_summary_source, created_at, updated_at")
    .eq("user_id", ctx.user.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) {
    const safe = q.replace(/[%_,()]/g, " ");
    query = query.or(`title.ilike.%${safe}%,body.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  dbError(error, "journal entry");
  return json({ entries: data ?? [] });
});

export const POST = withAuth(async (ctx, req) => {
  const body = await parseBody(req, journalBody);
  if (body.source_session_id) {
    const { data: s } = await ctx.supabase.from("chat_sessions").select("id").eq("id", body.source_session_id).eq("user_id", ctx.user.id).maybeSingle();
    if (!s) body.source_session_id = null;
  }
  const { data, error } = await ctx.supabase
    .from("journal_entries")
    .insert({ ...body, entry_date: body.entry_date ?? new Date().toISOString().slice(0, 10), user_id: ctx.user.id })
    .select()
    .single();
  dbError(error, "journal entry");
  return json({ entry: data }, 201);
});
