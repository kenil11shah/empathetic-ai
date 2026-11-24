import { dbError, json, parseBody, withAuth } from "@/lib/api";
import { taskBody } from "@/lib/validation";

export const GET = withAuth(async (ctx) => {
  const { data, error } = await ctx.supabase
    .from("tasks")
    .select("*")
    .eq("user_id", ctx.user.id)
    .order("status", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);
  dbError(error, "task");
  return json({ tasks: data ?? [] });
});

// Direct user form submission (no approval needed — the user is the author).
export const POST = withAuth(async (ctx, req) => {
  const body = await parseBody(req, taskBody);
  const { data, error } = await ctx.supabase.from("tasks").insert({ ...body, user_id: ctx.user.id }).select().single();
  dbError(error, "task");
  return json({ task: data }, 201);
});
