import { json } from "@/lib/api";
import { demoFlags, publicEnv } from "@/lib/env";

export async function GET() {
  return json({ status: "ok", database_configured: !!publicEnv.supabaseUrl, demo: demoFlags(), time: new Date().toISOString() });
}
