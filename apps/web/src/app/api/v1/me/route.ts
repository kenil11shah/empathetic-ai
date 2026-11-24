import { dbError, json, parseBody, withAuth } from "@/lib/api";
import { getConsents } from "@/lib/consents";
import { demoFlags } from "@/lib/env";
import { profilePatch } from "@/lib/validation";

export const GET = withAuth(async (ctx) => {
  const { data: profile, error } = await ctx.supabase.from("profiles").select("*").eq("id", ctx.user.id).maybeSingle();
  dbError(error, "profile");
  return json({
    user: { id: ctx.user.id, email: ctx.user.email ?? null, is_guest: !!ctx.user.is_anonymous },
    profile,
    consents: await getConsents(ctx),
    demo: demoFlags(),
  });
});

export const PATCH = withAuth(async (ctx, req) => {
  const body = await parseBody(req, profilePatch);
  const { data, error } = await ctx.supabase.from("profiles").update(body).eq("id", ctx.user.id).select().single();
  dbError(error, "profile");
  return json({ profile: data });
});
