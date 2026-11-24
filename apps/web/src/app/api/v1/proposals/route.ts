import { dbError, json, withAuth } from "@/lib/api";

export const GET = withAuth(async (ctx) => {
  // Mark stale proposals as expired so the UI never offers them as actionable.
  await ctx.supabase
    .from("proposals")
    .update({ status: "expired", decided_at: new Date().toISOString() })
    .eq("user_id", ctx.user.id)
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());
  const { data, error } = await ctx.supabase
    .from("proposals")
    .select("id, session_id, type, preview, reason, payload, status, expires_at, created_at")
    .eq("user_id", ctx.user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  dbError(error, "proposal");
  return json({ proposals: data ?? [] });
});
