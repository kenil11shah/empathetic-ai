import { dbError, json, parseBody, withAuth } from "@/lib/api";
import { checkinBody } from "@/lib/validation";

export const GET = withAuth(async (ctx, req) => {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 60), 400);
  const { data, error } = await ctx.supabase
    .from("checkins")
    .select("*")
    .eq("user_id", ctx.user.id)
    .order("local_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  dbError(error, "check-in");
  return json({ checkins: data ?? [] });
});

export const POST = withAuth(async (ctx, req) => {
  const body = await parseBody(req, checkinBody);
  const { data, error } = await ctx.supabase.from("checkins").insert({ ...body, user_id: ctx.user.id }).select().single();
  dbError(error, "check-in");
  return json({ checkin: data }, 201);
});
