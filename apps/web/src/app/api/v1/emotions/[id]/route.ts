import { audit, dbError, json, parseBody, withAuth } from "@/lib/api";
import { emotionPatch } from "@/lib/validation";

// Stores the user's correction as authoritative self-report. Never used for silent training.
export const PATCH = withAuth(async (ctx, req, { id }) => {
  const body = await parseBody(req, emotionPatch);
  const { data, error } = await ctx.supabase
    .from("emotion_events")
    .update({
      ...(body.corrected_label !== undefined ? { corrected_label: body.corrected_label } : {}),
      ...(body.dismissed !== undefined ? { dismissed: body.dismissed } : {}),
    })
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .select("id, top_label, corrected_label, dismissed")
    .single();
  dbError(error, "emotion hint");
  await audit(ctx, "correct", "emotion_event", id);
  return json({ emotion: data });
});
