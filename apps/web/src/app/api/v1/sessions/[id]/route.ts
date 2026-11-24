import { audit, dbError, json, parseBody, withAuth } from "@/lib/api";
import { sessionPatch } from "@/lib/validation";

export const GET = withAuth(async (ctx, _req, { id }) => {
  const { data: session, error } = await ctx.supabase
    .from("chat_sessions")
    .select("id, title, mode, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .single();
  dbError(error, "conversation");
  const [{ data: messages }, { data: proposals }, { data: emotions }] = await Promise.all([
    ctx.supabase.from("messages").select("id, role, content, request_id, safety_route, meta, created_at").eq("session_id", id).order("created_at"),
    ctx.supabase.from("proposals").select("id, type, preview, reason, payload, status, expires_at, result, created_at").eq("session_id", id).order("created_at"),
    ctx.supabase.from("emotion_events").select("id, message_id, top_label, corrected_label, dismissed").eq("user_id", ctx.user.id),
  ]);
  return json({ session, messages: messages ?? [], proposals: proposals ?? [], emotions: emotions ?? [] });
});

export const PATCH = withAuth(async (ctx, req, { id }) => {
  const body = await parseBody(req, sessionPatch);
  const { data, error } = await ctx.supabase
    .from("chat_sessions")
    .update(body)
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .select("id, title, mode, created_at, updated_at")
    .single();
  dbError(error, "conversation");
  return json({ session: data });
});

export const DELETE = withAuth(async (ctx, _req, { id }) => {
  const { error } = await ctx.supabase.from("chat_sessions").delete().eq("id", id).eq("user_id", ctx.user.id);
  dbError(error, "conversation");
  await audit(ctx, "delete", "chat_session", id);
  return json({ ok: true });
});
