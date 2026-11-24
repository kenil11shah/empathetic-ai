import { ApiError, dbError, json, parseBody, withAuth } from "@/lib/api";
import { approveBody, journalPayload, memoryPayload, taskPlanPayload } from "@/lib/validation";

const SCHEMA = { task_plan: taskPlanPayload, journal_entry: journalPayload, memory: memoryPayload } as const;

/**
 * Approve (optionally with an edited payload). The server re-validates the payload against
 * the proposal's type, then a single database transaction (approve_proposal) checks
 * ownership, status and expiry and executes exactly once. Repeat calls replay the result.
 */
export const POST = withAuth(async (ctx, req, { id }) => {
  const body = await parseBody(req, approveBody);
  const { data: proposal, error } = await ctx.supabase
    .from("proposals")
    .select("id, type, payload, status")
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .single();
  dbError(error, "proposal");
  if (!proposal) throw new ApiError(404, "not_found", "That suggestion was not found.");

  const schema = SCHEMA[proposal.type as keyof typeof SCHEMA];
  const payload = schema.parse(body.payload ?? proposal.payload);

  const { data: result, error: rpcErr } = await ctx.supabase.rpc("approve_proposal", { p_id: id, p_payload: payload });
  dbError(rpcErr, "proposal");
  const r = result as { ok?: boolean; code?: string; replayed?: boolean } & Record<string, unknown>;
  if (!r?.ok) {
    if (r?.code === "expired") throw new ApiError(409, "expired", "This suggestion expired. Ask again to get a fresh one.");
    if (r?.code === "not_pending") throw new ApiError(409, "not_pending", "This suggestion was already handled.");
    if (r?.code === "consent_required") throw new ApiError(403, "consent_required", "Turn on memory in Settings to save memories.");
    if (r?.code === "not_found") throw new ApiError(404, "not_found", "That suggestion was not found.");
    throw new ApiError(400, r?.code ?? "invalid_payload", "That suggestion couldn't be applied.");
  }
  return json({ result: r });
});
