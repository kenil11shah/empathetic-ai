import "server-only";
import type { Ctx } from "@/lib/api";
import { CONSENT_TYPES, type ConsentType } from "@/lib/constants";

export async function getConsents(ctx: Ctx): Promise<Record<ConsentType, boolean>> {
  const { data } = await ctx.supabase.from("consents").select("consent_type, granted").eq("user_id", ctx.user.id);
  const out = Object.fromEntries(CONSENT_TYPES.map((c) => [c, false])) as Record<ConsentType, boolean>;
  for (const row of data ?? []) out[row.consent_type as ConsentType] = !!row.granted;
  return out;
}
