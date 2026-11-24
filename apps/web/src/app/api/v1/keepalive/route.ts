import { createClient } from "@supabase/supabase-js";
import { json } from "@/lib/api";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const GUEST_MAX_AGE_DAYS = 30;

/**
 * Called once a day by Vercel Cron (see vercel.json).
 * 1. Touches the database so the free Supabase project never pauses for inactivity.
 * 2. Deletes guest (anonymous) accounts older than 30 days, with all their data,
 *    so the free database doesn't fill up with abandoned demo sessions.
 * Both steps are safe to run more than once.
 */
export async function GET() {
  const result: Record<string, unknown> = { at: new Date().toISOString() };
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseKey) return json({ ...result, database: "not_configured" }, 503);

  const anon = createClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, { auth: { persistSession: false } });
  const { error } = await anon.rpc("keepalive");
  result.database = error ? "error" : "ok";

  const admin = createAdminClient();
  if (admin) {
    const cutoff = Date.now() - GUEST_MAX_AGE_DAYS * 86400_000;
    let removed = 0;
    for (let page = 1; page <= 20; page++) {
      const { data, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listErr || !data?.users?.length) break;
      for (const u of data.users) {
        if (u.is_anonymous && Date.parse(u.created_at) < cutoff) {
          const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
          if (!delErr) removed++;
        }
      }
      if (data.users.length < 1000) break;
    }
    result.guests_removed = removed;
  }
  return json(result, error ? 500 : 200);
}
