import { dbError, json, parseBody, withAuth } from "@/lib/api";
import { sessionCreate } from "@/lib/validation";

export const GET = withAuth(async (ctx) => {
  const { data, error } = await ctx.supabase
    .from("chat_sessions")
    .select("id, title, mode, created_at, updated_at")
    .eq("user_id", ctx.user.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  dbError(error, "conversation");
  return json({ sessions: data ?? [] });
});

// Private sessions are never created here: they live only in the browser.
export const POST = withAuth(async (ctx, req) => {
  const body = await parseBody(req, sessionCreate);
  const { data, error } = await ctx.supabase
    .from("chat_sessions")
    .insert({ user_id: ctx.user.id, mode: body.mode, title: body.title || "New conversation" })
    .select("id, title, mode, created_at, updated_at")
    .single();
  dbError(error, "conversation");
  return json({ session: data }, 201);
});
