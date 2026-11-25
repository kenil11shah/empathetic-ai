import { z } from "zod";
import { ApiError, json, parseBody, withAuth } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Deletes the auth user. Every user-owned table cascades from auth.users, so all active
 * records are purged in the same operation. Backups follow the provider's retention policy.
 */
export const DELETE = withAuth(async (ctx, req) => {
  const body = await parseBody(req, z.object({ confirm: z.literal("DELETE") }));
  void body;
  const admin = createAdminClient();
  if (!admin) {
    throw new ApiError(503, "not_configured", "Account deletion needs the server secret key. See docs/DEPLOYMENT.md (SUPABASE_SECRET_KEY).");
  }
  const { error } = await admin.auth.admin.deleteUser(ctx.user.id);
  if (error) throw new ApiError(500, "delete_failed", "We couldn't delete your account just now. Please try again.");
  await ctx.supabase.auth.signOut();
  return json({
    ok: true,
    status: "deleted",
    note: "Your account and all active records were deleted. Encrypted provider backups expire on their own schedule.",
  });
});
