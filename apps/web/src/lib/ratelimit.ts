import "server-only";
import { ApiError, type Ctx } from "@/lib/api";
import { serverEnv } from "@/lib/env";

/** Per-user rate limit backed by a content-free usage table (works across serverless instances). */
export async function enforceRateLimit(ctx: Ctx, kind: "message" | "transcribe" | "summary") {
  const env = serverEnv();
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  const [{ count: hour }, { count: day }] = await Promise.all([
    ctx.supabase.from("usage_events").select("id", { count: "exact", head: true }).eq("user_id", ctx.user.id).gte("created_at", hourAgo),
    ctx.supabase.from("usage_events").select("id", { count: "exact", head: true }).eq("user_id", ctx.user.id).gte("created_at", dayAgo),
  ]);
  if ((hour ?? 0) >= env.rateLimitPerHour || (day ?? 0) >= env.rateLimitPerDay) {
    throw new ApiError(429, "rate_limited", "You've reached the usage limit for this demo. Please try again a little later.");
  }
  await ctx.supabase.from("usage_events").insert({ user_id: ctx.user.id, kind });
}
