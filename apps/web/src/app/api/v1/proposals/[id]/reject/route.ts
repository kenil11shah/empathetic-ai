import { ApiError, audit, dbError, json, withAuth } from "@/lib/api";

export const POST = withAuth(async (ctx, _req, { id }) => {
  const { data, error } = await ctx.supabase
    .from("proposals")
    .update({ status: "rejected", decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .eq("status", "pending")
    .select("id, status");
  dbError(error, "proposal");
  if (!data?.length) throw new ApiError(409, "not_pending", "This suggestion was already handled.");
  await audit(ctx, "reject", "proposal", id);
  return json({ proposal: data[0] });
});
