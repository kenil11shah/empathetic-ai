import { dbError, json, parseBody, withAuth } from "@/lib/api";
import { checkinBody } from "@/lib/validation";

export const PATCH = withAuth(async (ctx, req, { id }) => {
  const body = await parseBody(req, checkinBody.partial());
  const { data, error } = await ctx.supabase.from("checkins").update(body).eq("id", id).eq("user_id", ctx.user.id).select().single();
  dbError(error, "check-in");
  return json({ checkin: data });
});

export const DELETE = withAuth(async (ctx, _req, { id }) => {
  const { error } = await ctx.supabase.from("checkins").delete().eq("id", id).eq("user_id", ctx.user.id);
  dbError(error, "check-in");
  return json({ ok: true });
});
