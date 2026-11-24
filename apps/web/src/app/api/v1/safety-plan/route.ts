import { dbError, json, parseBody, withAuth } from "@/lib/api";
import { resourcesFor } from "@/lib/safety/resources";
import { safetyPlanBody } from "@/lib/validation";

export const GET = withAuth(async (ctx) => {
  const [{ data: plan }, { data: contacts }, { data: profile }] = await Promise.all([
    ctx.supabase.from("safety_plans").select("*").eq("user_id", ctx.user.id).maybeSingle(),
    ctx.supabase.from("trusted_contacts").select("*").eq("user_id", ctx.user.id).order("created_at"),
    ctx.supabase.from("profiles").select("country").eq("id", ctx.user.id).single(),
  ]);
  return json({ plan, contacts: contacts ?? [], resources: resourcesFor(profile?.country) });
});

export const PUT = withAuth(async (ctx, req) => {
  const body = await parseBody(req, safetyPlanBody);
  const { data, error } = await ctx.supabase
    .from("safety_plans")
    .upsert({ ...body, user_id: ctx.user.id, updated_at: new Date().toISOString() })
    .select()
    .single();
  dbError(error, "safety plan");
  return json({ plan: data });
});
