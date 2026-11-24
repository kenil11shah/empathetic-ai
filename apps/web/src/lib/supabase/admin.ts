import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

// Service-role client. Used ONLY for account deletion (auth.admin.deleteUser).
export function createAdminClient() {
  const secret = serverEnv().supabaseSecret;
  if (!secret) return null;
  return createClient(publicEnv.supabaseUrl, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
