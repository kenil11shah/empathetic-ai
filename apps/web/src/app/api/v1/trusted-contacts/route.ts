import { ApiError, dbError, json, parseBody, withAuth } from "@/lib/api";
import { contactBody } from "@/lib/validation";

// Stored for the user's own reference. The app NEVER messages these contacts automatically.
export const POST = withAuth(async (ctx, req) => {
  const body = await parseBody(req, contactBody);
  const { count } = await ctx.supabase.from("trusted_contacts").select("id", { count: "exact", head: true }).eq("user_id", ctx.user.id);
  if ((count ?? 0) >= 5) throw new ApiError(400, "limit", "You can save up to 5 trusted contacts.");
  const { data, error } = await ctx.supabase.from("trusted_contacts").insert({ ...body, user_id: ctx.user.id }).select().single();
  dbError(error, "contact");
  return json({ contact: data }, 201);
});
