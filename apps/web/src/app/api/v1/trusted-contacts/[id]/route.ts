import { dbError, json, withAuth } from "@/lib/api";

export const DELETE = withAuth(async (ctx, _req, { id }) => {
  const { error } = await ctx.supabase.from("trusted_contacts").delete().eq("id", id).eq("user_id", ctx.user.id);
  dbError(error, "contact");
  return json({ ok: true });
});
