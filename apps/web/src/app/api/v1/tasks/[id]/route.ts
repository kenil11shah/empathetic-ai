import { dbError, json, parseBody, withAuth } from "@/lib/api";
import { taskBody } from "@/lib/validation";

export const PATCH = withAuth(async (ctx, req, { id }) => {
  const body = await parseBody(req, taskBody.partial());
  const patch: Record<string, unknown> = { ...body };
  if (body.status) patch.completed_at = body.status === "done" ? new Date().toISOString() : null;
  const { data, error } = await ctx.supabase.from("tasks").update(patch).eq("id", id).eq("user_id", ctx.user.id).select().single();
  dbError(error, "task");
  return json({ task: data });
});

export const DELETE = withAuth(async (ctx, _req, { id }) => {
  const { error } = await ctx.supabase.from("tasks").delete().eq("id", id).eq("user_id", ctx.user.id);
  dbError(error, "task");
  return json({ ok: true });
});
