import { audit, dbError, json, parseBody, withAuth } from "@/lib/api";
import { getConsents } from "@/lib/consents";
import { consentsBody } from "@/lib/validation";

export const GET = withAuth(async (ctx) => json({ consents: await getConsents(ctx) }));

export const PUT = withAuth(async (ctx, req) => {
  const body = await parseBody(req, consentsBody);
  const rows = body.consents.map((c) => ({
    user_id: ctx.user.id,
    consent_type: c.consent_type,
    granted: c.consent_type === "research" ? false : c.granted,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await ctx.supabase.from("consents").upsert(rows);
  dbError(error, "consent");
  // Revoking emotion history removes stored inferred hints.
  if (rows.some((r) => r.consent_type === "emotion_history" && !r.granted)) {
    await ctx.supabase.from("emotion_events").delete().eq("user_id", ctx.user.id);
  }
  for (const r of rows) await audit(ctx, r.granted ? "grant" : "revoke", `consent:${r.consent_type}`);
  return json({ consents: await getConsents(ctx) });
});
