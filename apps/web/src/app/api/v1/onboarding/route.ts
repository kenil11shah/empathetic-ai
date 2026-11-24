import { audit, dbError, json, parseBody, withAuth } from "@/lib/api";
import { CONSENT_TYPES, DISCLOSURE_VERSION } from "@/lib/constants";
import { onboardingBody } from "@/lib/validation";

export const POST = withAuth(async (ctx, req) => {
  const body = await parseBody(req, onboardingBody);
  const { error } = await ctx.supabase.from("profiles").upsert({
    id: ctx.user.id,
    display_name: body.display_name ?? null,
    country: body.country,
    timezone: body.timezone,
    default_mode: body.default_mode,
    adult_confirmed: true,
    disclosure_version: DISCLOSURE_VERSION,
    onboarded_at: new Date().toISOString(),
  });
  dbError(error, "profile");
  const rows = CONSENT_TYPES.map((c) => ({
    user_id: ctx.user.id,
    consent_type: c,
    // Research is not used in this prototype and stays off.
    granted: c === "research" ? false : !!body.consents[c],
    updated_at: new Date().toISOString(),
  }));
  const { error: cErr } = await ctx.supabase.from("consents").upsert(rows);
  dbError(cErr, "consent");
  const tc = body.trusted_contact;
  if (tc?.name) {
    const { count } = await ctx.supabase.from("trusted_contacts").select("id", { count: "exact", head: true }).eq("user_id", ctx.user.id);
    if (!count) {
      const { error: tErr } = await ctx.supabase.from("trusted_contacts").insert({
        user_id: ctx.user.id,
        name: tc.name,
        email: tc.email ?? null,
        phone: tc.phone ?? null,
        relationship: tc.relationship ?? null,
      });
      dbError(tErr, "trusted contact");
    }
  }
  await audit(ctx, "onboard", "profile", ctx.user.id);
  return json({ ok: true });
});
