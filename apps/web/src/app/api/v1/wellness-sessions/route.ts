import { ApiError, dbError, json, parseBody, withAuth } from "@/lib/api";
import { ACTIVITIES } from "@/lib/wellness";
import { wellnessBody } from "@/lib/validation";

export const GET = withAuth(async (ctx) => {
  const { data, error } = await ctx.supabase.from("wellness_sessions").select("*").eq("user_id", ctx.user.id).order("created_at", { ascending: false }).limit(50);
  dbError(error, "activity");
  return json({ sessions: data ?? [] });
});

export const POST = withAuth(async (ctx, req) => {
  const body = await parseBody(req, wellnessBody);
  if (!ACTIVITIES.some((a) => a.id === body.activity_id)) throw new ApiError(400, "invalid_input", "Unknown activity.");
  const { data, error } = await ctx.supabase.from("wellness_sessions").insert({ ...body, user_id: ctx.user.id }).select().single();
  dbError(error, "activity");
  return json({ session: data }, 201);
});
