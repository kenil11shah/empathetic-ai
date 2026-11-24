import { ApiError, audit, json, withAuth } from "@/lib/api";

// Synthetic, clearly labelled sample data for exploring Insights. Removable at any time.
export const POST = withAuth(async (ctx) => {
  const { data, error } = await ctx.supabase.rpc("seed_sample_data");
  if (error) throw new ApiError(500, "seed_failed", "Couldn't add sample data. Is migration 0002 applied?");
  await audit(ctx, "seed", "sample_data");
  return json({ result: data });
});

export const DELETE = withAuth(async (ctx) => {
  const { error } = await ctx.supabase.rpc("remove_sample_data");
  if (error) throw new ApiError(500, "remove_failed", "Couldn't remove sample data.");
  await audit(ctx, "remove", "sample_data");
  return json({ ok: true });
});
