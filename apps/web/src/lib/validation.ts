import { z } from "zod";
import { CONSENT_TYPES, EMOTIONS, MODES } from "@/lib/constants";

const trimmed = (max: number) => z.string().trim().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");
const tagList = z.array(trimmed(40).min(1)).max(12).default([]);

export const sessionCreate = z.object({ mode: z.enum(MODES).default("just_listen"), title: trimmed(120).optional() });
export const sessionPatch = z.object({ mode: z.enum(MODES).optional(), title: trimmed(120).min(1).optional() });

export const historyTurn = z.object({ role: z.enum(["user", "assistant"]), content: trimmed(4000) });

export const messageCreate = z.object({
  text: trimmed(4000).min(1, "message is empty"),
  request_id: z.string().min(8).max(64),
  mode: z.enum(MODES),
  input: z.enum(["text", "voice"]).default("text"),
  self_report: z.enum([...EMOTIONS, "mixed_unknown"]).nullable().optional(),
  // Only used for private sessions, which are never stored on the server.
  history: z.array(historyTurn).max(16).optional(),
});

export const emotionPatch = z.object({
  corrected_label: z.enum([...EMOTIONS, "mixed_unknown"]).nullable().optional(),
  dismissed: z.boolean().optional(),
});

export const taskPlanPayload = z.object({
  tasks: z
    .array(z.object({ title: trimmed(200).min(1), due_date: isoDate.nullable().optional() }))
    .min(1)
    .max(8),
});
export const journalPayload = z.object({ title: trimmed(200), body: trimmed(20000).min(1), tags: tagList });
export const memoryPayload = z.object({
  summary: trimmed(400).min(1),
  category: z.enum(["preference", "goal", "helpful_activity", "event", "theme", "other"]).default("other"),
});
export const approveBody = z.object({ payload: z.unknown().optional() });

export const checkinBody = z.object({
  mood: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(10),
  energy: z.number().int().min(1).max(10),
  sleep_hours: z.number().min(0).max(24).nullable().optional(),
  emotions: z.array(z.enum(EMOTIONS)).max(7).default([]),
  tags: tagList,
  notes: trimmed(2000).nullable().optional(),
  local_date: isoDate,
  timezone: trimmed(64).default("UTC"),
});

export const journalBody = z.object({
  title: trimmed(200).default(""),
  body: trimmed(20000).default(""),
  tags: tagList,
  entry_date: isoDate.optional(),
  source_kind: z.enum(["manual", "voice", "chat"]).default("manual"),
  source_session_id: z.string().uuid().nullable().optional(),
  ai_summary: trimmed(2000).nullable().optional(),
  ai_summary_source: trimmed(80).nullable().optional(),
});

export const taskBody = z.object({
  title: trimmed(200).min(1),
  notes: trimmed(2000).nullable().optional(),
  due_date: isoDate.nullable().optional(),
  status: z.enum(["todo", "done"]).optional(),
});

export const memoryBody = memoryPayload;

export const wellnessBody = z.object({
  activity_id: trimmed(60).min(1),
  duration_seconds: z.number().int().min(0).max(7200),
  completed: z.boolean().default(false),
  helpful: z.enum(["yes", "somewhat", "no"]).nullable().optional(),
});

export const safetyPlanBody = z.object({
  warning_signs: trimmed(2000).default(""),
  coping_steps: trimmed(2000).default(""),
  reasons: trimmed(2000).default(""),
  safe_places: trimmed(2000).default(""),
  professional_contacts: trimmed(2000).default(""),
});

export const contactBody = z.object({
  name: trimmed(80).min(1),
  email: z.union([z.literal(""), z.string().trim().email("enter a valid email").max(254)]).nullable().optional().transform((v) => v || null),
  phone: trimmed(30).regex(/^[+0-9 ()-]*$/, "digits, spaces, +, - and () only").nullable().optional(),
  relationship: trimmed(60).nullable().optional(),
  note: trimmed(300).nullable().optional(),
});

export const consentsBody = z.object({
  consents: z.array(z.object({ consent_type: z.enum(CONSENT_TYPES), granted: z.boolean() })).min(1),
});

export const profilePatch = z.object({
  display_name: trimmed(80).nullable().optional(),
  timezone: trimmed(64).optional(),
  country: z.enum(["IN", "US", "GB", "CA", "AU", "OTHER"]).optional(),
  default_mode: z.enum(MODES).optional(),
  voice_output: z.boolean().optional(),
});

export const onboardingBody = z.object({
  adult_confirmed: z.literal(true, { message: "You must confirm you are 18 or older." }),
  disclosure_ack: z.literal(true, { message: "Please acknowledge the disclosure." }),
  display_name: trimmed(80).nullable().optional(),
  country: z.enum(["IN", "US", "GB", "CA", "AU", "OTHER"]),
  timezone: trimmed(64).default("UTC"),
  default_mode: z.enum(MODES).default("just_listen"),
  consents: z.partialRecord(z.enum(CONSENT_TYPES), z.boolean()).default({}),
  trusted_contact: z.lazy(() => contactBody).nullable().optional(),
});

export const draftSummaryBody = z.object({ entry_id: z.string().uuid() });
