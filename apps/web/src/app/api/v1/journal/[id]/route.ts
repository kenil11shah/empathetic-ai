import { audit, dbError, json, parseBody, withAuth } from "@/lib/api";
import { journalBody } from "@/lib/validation";

export const GET = withAuth(async (ctx, _req, { id }) => {
  const { data, error } = await ctx.supabase.from("journal_entries").select("*").eq("id", id).eq("user_id", ctx.user.id).single();
  dbError(error, "journal entry");
  return json({ entry: data });
});

export const PATCH = withAuth(async (ctx, req, { id }) => {
  const body = await parseBody(req, journalBody.partial().omit({ source_session_id: true }));
  const { data, error } = await ctx.supabase.from("journal_entries").update(body).eq("id", id).eq("user_id", ctx.user.id).select().single();
  dbError(error, "journal entry");
  return json({ entry: data });
});

// Deleting an entry also deletes its derived AI summary (same row).
export const DELETE = withAuth(async (ctx, _req, { id }) => {
  const { error } = await ctx.supabase.from("journal_entries").delete().eq("id", id).eq("user_id", ctx.user.id);
  dbError(error, "journal entry");
  await audit(ctx, "delete", "journal_entry", id);
  return json({ ok: true });
});
