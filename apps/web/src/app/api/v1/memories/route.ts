import { ApiError, audit, dbError, json, parseBody, withAuth } from "@/lib/api";
import { getConsents } from "@/lib/consents";
import { memoryBody } from "@/lib/validation";

export const GET = withAuth(async (ctx, req) => {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100).replace(/[%_,()]/g, " ");
  let query = ctx.supabase
    .from("memories")
    .select("id, summary, category, source_type, source_id, expires_at, created_at, updated_at")
    .eq("user_id", ctx.user.id)
    .order("updated_at", { ascending: false });
  if (q) query = query.ilike("summary", `%${q}%`);
  const { data, error } = await query;
  dbError(error, "memory");
  return json({ memories: data ?? [], enabled: (await getConsents(ctx)).memory });
});

export const POST = withAuth(async (ctx, req) => {
  if (!(await getConsents(ctx)).memory) throw new ApiError(403, "consent_required", "Turn on memory to add memories.");
  const body = await parseBody(req, memoryBody);
  const { data, error } = await ctx.supabase.from("memories").insert({ ...body, user_id: ctx.user.id, source_type: "manual" }).select().single();
  dbError(error, "memory");
  return json({ memory: data }, 201);
});

// Clear all memories.
export const DELETE = withAuth(async (ctx) => {
  const { error } = await ctx.supabase.from("memories").delete().eq("user_id", ctx.user.id);
  dbError(error, "memory");
  await audit(ctx, "clear_all", "memory");
  return json({ ok: true });
});
