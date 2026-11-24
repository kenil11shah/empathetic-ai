import { z } from "zod";
import { dbError, json, parseBody, withAuth } from "@/lib/api";

export const POST = withAuth(async (ctx, req, { id }) => {
  const body = await parseBody(req, z.object({ helpful: z.boolean() }));
  if (id !== "private") {
    const { error: sErr } = await ctx.supabase.from("chat_sessions").select("id").eq("id", id).eq("user_id", ctx.user.id).single();
    dbError(sErr, "conversation");
  }
  const { error } = await ctx.supabase
    .from("session_feedback")
    .insert({ user_id: ctx.user.id, session_id: id === "private" ? null : id, helpful: body.helpful });
  dbError(error, "feedback");
  return json({ ok: true });
});
