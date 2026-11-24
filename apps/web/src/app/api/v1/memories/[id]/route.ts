import { audit, dbError, json, parseBody, withAuth } from "@/lib/api";
import { memoryBody } from "@/lib/validation";

export const PATCH = withAuth(async (ctx, req, { id }) => {
  const body = await parseBody(req, memoryBody.partial());
  const { data, error } = await ctx.supabase.from("memories").update(body).eq("id", id).eq("user_id", ctx.user.id).select().single();
  dbError(error, "memory");
  return json({ memory: data });
});

export const DELETE = withAuth(async (ctx, _req, { id }) => {
  const { error } = await ctx.supabase.from("memories").delete().eq("id", id).eq("user_id", ctx.user.id);
  dbError(error, "memory");
  await audit(ctx, "delete", "memory", id);
  return json({ ok: true });
});
