/**
 * In-browser mock of the /api/v1 backend for the single-file preview.
 * It reuses the app's real logic modules (safety policy, reviewed templates, TF-IDF+LR model,
 * fusion, strategy, demo responder, output guard, insights). Only the LLM, transcription and
 * database are simulated. Data lives in memory, mirrored to localStorage when it is available.
 */
import { CONSENT_TYPES, EMOTION_LABEL, PROPOSAL_TTL_MINUTES, type ConsentType, type EmotionOrUnknown, type Mode } from "@/lib/constants";
import { checkOutput, screenInput } from "@/lib/safety/policy";
import { fallbackReply, templateReply } from "@/lib/safety/templates";
import { RESOURCES, resourcesFor } from "@/lib/safety/resources";
import { predictBaseline } from "@/lib/emotion/baseline";
import { fuse, hintPhrase, shouldShowHint } from "@/lib/emotion/fusion";
import { explicitPlanRequest, ruleIntent } from "@/lib/emotion/intent";
import { selectStrategy } from "@/lib/ai/strategy";
import { mockReply } from "@/lib/ai/mock";
import { buildInsights, dateRange, distribution, RANGES, type RangeKey } from "@/lib/insights";
import { journalPayload, memoryPayload, taskPlanPayload } from "@/lib/validation";
import { ACTIVITIES } from "@/lib/wellness";

type Row = Record<string, unknown> & { id: string };
type DB = {
  auth: { signedIn: boolean; guest: boolean; email: string | null };
  profile: Record<string, unknown>;
  consents: Record<ConsentType, boolean>;
  sessions: Row[];
  messages: Row[];
  emotions: Row[];
  proposals: Row[];
  tasks: Row[];
  checkins: Row[];
  journal: Row[];
  memories: Row[];
  wellness: Row[];
  plan: Record<string, string> | null;
  contacts: Row[];
};

const KEY = "empathetic-ai-preview-v1";
const fresh = (): DB => ({
  auth: { signedIn: false, guest: false, email: null },
  profile: { display_name: null, country: "IN", timezone: "Asia/Kolkata", default_mode: "just_listen", voice_output: false, onboarded_at: null },
  consents: Object.fromEntries(CONSENT_TYPES.map((c) => [c, false])) as Record<ConsentType, boolean>,
  sessions: [], messages: [], emotions: [], proposals: [], tasks: [], checkins: [], journal: [], memories: [], wellness: [], plan: null, contacts: [],
});

let db: DB = fresh();
try {
  const saved = localStorage.getItem(KEY);
  if (saved) db = { ...fresh(), ...JSON.parse(saved) };
} catch {}
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {}
};

const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const now = () => new Date().toISOString();
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const previewAuth = {
  isSignedIn: () => db.auth.signedIn,
  isOnboarded: () => !!db.profile.onboarded_at,
  signIn(guest: boolean, email: string | null) {
    db.auth = { signedIn: true, guest, email };
    save();
  },
  setEmail(email: string) {
    db.auth.email = email;
    db.auth.guest = false;
    save();
  },
  signOut() {
    db.auth = { signedIn: false, guest: false, email: null };
    save();
  },
  reset() {
    db = fresh();
    save();
  },
};

// ---------------------------------------------------------------- one chat turn
function turn(text: string, mode: Mode, history: { role: string; content: string }[], selfReport: EmotionOrUnknown | null, isPrivate: boolean, recentHints: EmotionOrUnknown[], lastAsked: boolean) {
  const resources = resourcesFor(String(db.profile.country));
  const screen = screenInput(text, history.filter((h) => h.role === "user").map((h) => h.content));
  if (screen.route === "immediate") {
    return { reply: templateReply("immediate", resources), route: "immediate", categories: screen.categories, emotion: fuse([], selfReport), hint: null, intent: "unknown", strategy: "template", proposals: [], quick: [], showResources: true };
  }
  const base = predictBaseline(text);
  const emotion = fuse([{ source: "tfidf_lr", probs: base.probs, quality: Math.min(1, base.coverage * 1.5), model_version: base.model_version }], selfReport);
  const intent = ruleIntent(text);
  const explicit = explicitPlanRequest(text);
  if (screen.use_template && screen.template) {
    return { reply: templateReply(screen.template, resources), route: screen.route, categories: screen.categories, emotion, hint: null, intent, strategy: "template", proposals: [], quick: [], showResources: true };
  }
  const strategy = selectStrategy({
    mode, intent, route: screen.route, explicitPlan: explicit, isPrivate, memoryConsent: db.consents.memory,
    needsClarification: emotion.abstained && intent === "unknown" && !lastAsked && text.length > 25,
  });
  const draft = mockReply(text, strategy, emotion.label);
  const proposals: { type: string; reason: string; payload: unknown }[] = [];
  const p = draft.proposal as Record<string, unknown> | null;
  if (p?.type === "task_plan" && strategy.allowTaskProposal) {
    const ok = taskPlanPayload.safeParse({ tasks: p.tasks });
    if (ok.success) proposals.push({ type: "task_plan", reason: String(p.reason ?? ""), payload: ok.data });
  } else if (p?.type === "journal_entry" && strategy.allowJournalProposal) {
    const ok = journalPayload.safeParse({ title: p.title, body: p.body, tags: p.tags });
    if (ok.success) proposals.push({ type: "journal_entry", reason: String(p.reason ?? ""), payload: ok.data });
  }
  if (strategy.allowMemorySuggestion && /\b(i prefer|i like it when|please always|i'd rather)\b/i.test(text)) {
    proposals.push({ type: "memory", reason: "Only saved if you approve. You can edit or delete it any time.", payload: { summary: text.slice(0, 200), category: "preference" } });
  }
  const check = checkOutput(draft.reply);
  return {
    reply: check.ok ? draft.reply : fallbackReply(resources),
    route: screen.route,
    categories: screen.categories,
    emotion,
    hint: shouldShowHint(emotion, recentHints) ? { label: emotion.label, phrase: hintPhrase(emotion) } : null,
    intent,
    strategy: strategy.id,
    proposals: check.ok ? proposals : [],
    quick: strategy.offerChoices ? ["Just listen", "Help me think it through", "Help me calm down"] : [],
    showResources: screen.route === "concern" || screen.route === "uncertain",
  };
}

const PREVIEW_TEXT: Record<string, string> = {
  task_plan: "Add these tasks to your task list",
  journal_entry: "Save this as a journal entry",
  memory: "Remember this for future conversations",
};

function seedSample() {
  if (db.checkins.some((c) => (c.tags as string[]).includes("sample"))) return;
  const t = today();
  const days = dateRange(t, 21).reverse();
  for (let d = 1; d <= 20; d++) {
    if (d % 4 === 0) continue;
    const emo = ["joy", "fear_anxiety", "frustration", "calm", "sadness"][d % 5];
    db.checkins.push({
      id: uid(), mood: Math.max(1, Math.min(5, 3 + ((d * 7) % 5) - 2 + (d % 3 === 0 ? 1 : 0))), stress: Math.max(1, Math.min(10, 4 + ((d * 5) % 7) - 2)),
      energy: Math.max(1, Math.min(10, 5 + ((d * 3) % 5) - 2)), sleep_hours: 6 + (d % 3), emotions: [emo], tags: ["sample", ["exams", "work", "family"][d % 3]],
      notes: null, local_date: days[d], created_at: now(),
    });
  }
  db.journal.push(
    { id: uid(), title: "Sample: after the mock interview", body: "This is sample text. It went better than I expected. I stumbled on the second question but recovered, and I noticed I talk faster when I am nervous.", tags: ["sample", "interviews"], entry_date: days[2], source_kind: "manual", ai_summary: null, ai_summary_source: null, created_at: now(), updated_at: now() },
    { id: uid(), title: "Sample: a slow Sunday", body: "This is sample text. Took a long walk, cooked, and did not open my laptop. Felt more rested than I have in a while.", tags: ["sample"], entry_date: days[6], source_kind: "manual", ai_summary: null, ai_summary_source: null, created_at: now(), updated_at: now() },
  );
  db.tasks.push(
    { id: uid(), title: "(sample) List all deadlines with dates", status: "done", due_date: null, notes: null, source_proposal_id: null, completed_at: now(), created_at: now() },
    { id: uid(), title: "(sample) Write one rough paragraph of the report", status: "todo", due_date: null, notes: null, source_proposal_id: null, completed_at: null, created_at: now() },
    { id: uid(), title: "(sample) Take a 10-minute walk after lunch", status: "todo", due_date: null, notes: null, source_proposal_id: null, completed_at: null, created_at: now() },
  );
}

// ---------------------------------------------------------------- router
type Req = { method: string; path: string; query: URLSearchParams; body: Record<string, unknown> };

async function handle({ method, path, query, body }: Req): Promise<[number, unknown]> {
  const seg = path.replace(/^\/api\/v1\/?/, "").split("/").filter(Boolean);
  const [a, b, c] = seg;
  const M = method.toUpperCase();
  const byId = (list: Row[], id: string) => {
    const r = list.find((x) => x.id === id);
    if (!r) throw new HttpError(404, "not_found", "That item was not found.");
    return r;
  };

  if (a === "health") return [200, { status: "ok", preview: true }];
  if (a === "resources") return [200, query.get("country") ? resourcesFor(query.get("country")) : { regions: Object.values(RESOURCES) }];

  if (a === "me" && M === "GET")
    return [200, {
      user: { id: "preview-user", email: db.auth.email, is_guest: db.auth.guest },
      profile: db.profile,
      consents: db.consents,
      demo: { llm: true, transcription: true, transformer: true, accountDeletion: false },
    }];
  if (a === "me" && M === "PATCH") {
    Object.assign(db.profile, body);
    return [200, { profile: db.profile }];
  }
  if (a === "onboarding") {
    if (body.adult_confirmed !== true || body.disclosure_ack !== true) throw new HttpError(400, "invalid_input", "Please confirm both boxes.");
    Object.assign(db.profile, { display_name: body.display_name ?? null, country: body.country, timezone: body.timezone, default_mode: body.default_mode, onboarded_at: now() });
    const cs = (body.consents ?? {}) as Record<string, boolean>;
    for (const k of CONSENT_TYPES) db.consents[k] = k === "research" ? false : !!cs[k];
    const tc = body.trusted_contact as Record<string, string> | null;
    if (tc?.name && !db.contacts.length) db.contacts.push({ id: uid(), name: tc.name, email: tc.email ?? null, phone: tc.phone ?? null, relationship: tc.relationship ?? null, created_at: now() });
    return [200, { ok: true }];
  }
  if (a === "consents") {
    for (const r of (body.consents as { consent_type: ConsentType; granted: boolean }[]) ?? []) {
      db.consents[r.consent_type] = r.consent_type === "research" ? false : r.granted;
      if (r.consent_type === "emotion_history" && !r.granted) db.emotions = [];
    }
    return [200, { consents: db.consents }];
  }

  // sessions
  if (a === "sessions" && !b && M === "GET") return [200, { sessions: [...db.sessions].sort((x, y) => String(y.updated_at).localeCompare(String(x.updated_at))) }];
  if (a === "sessions" && !b && M === "POST") {
    const s = { id: uid(), title: "New conversation", mode: body.mode ?? "just_listen", created_at: now(), updated_at: now() };
    db.sessions.push(s);
    return [201, { session: s }];
  }
  if (a === "sessions" && b && !c) {
    if (M === "GET") {
      const s = byId(db.sessions, b);
      return [200, { session: s, messages: db.messages.filter((m) => m.session_id === b), proposals: db.proposals.filter((p) => p.session_id === b), emotions: db.emotions }];
    }
    if (M === "PATCH") return [200, { session: Object.assign(byId(db.sessions, b), body) }];
    if (M === "DELETE") {
      db.sessions = db.sessions.filter((s) => s.id !== b);
      db.messages = db.messages.filter((m) => m.session_id !== b);
      db.proposals = db.proposals.filter((p) => p.session_id !== b);
      return [200, { ok: true }];
    }
  }
  if (a === "sessions" && c === "feedback") return [200, { ok: true }];
  if (a === "sessions" && c === "messages") {
    const isPrivate = b === "private";
    const text = String(body.text ?? "").trim();
    if (!text) throw new HttpError(400, "invalid_input", "text: message is empty");
    let history: { role: string; content: string }[] = [];
    let recentHints: EmotionOrUnknown[] = [];
    let lastAsked = false;
    let session: Row | null = null;
    if (!isPrivate) {
      session = byId(db.sessions, b);
      const prev = db.messages.find((m) => m.session_id === b && m.request_id === body.request_id && m.role === "assistant");
      if (prev) return [200, { replayed: true, message: prev, ...(prev.meta as object) }];
      const msgs = db.messages.filter((m) => m.session_id === b).slice(-12);
      history = msgs.map((m) => ({ role: String(m.role), content: String(m.content) }));
      recentHints = msgs.slice(-4).map((m) => (m.meta as { hint?: { label: EmotionOrUnknown } })?.hint?.label).filter(Boolean) as EmotionOrUnknown[];
      lastAsked = !!(msgs.filter((m) => m.role === "assistant").at(-1)?.meta as { asked_clarification?: boolean })?.asked_clarification;
    } else history = (body.history as { role: string; content: string }[]) ?? [];

    await sleep(500 + Math.random() * 500);
    const out = turn(text, body.mode as Mode, history, (body.self_report as EmotionOrUnknown) ?? null, isPrivate, recentHints, lastAsked);
    const meta = { hint: out.hint, route: out.route, show_resources: out.showResources, quick_replies: out.quick, demo: true, strategy: out.strategy, intent: out.intent, asked_clarification: /\?\s*$/.test(out.reply) && out.strategy !== "template" };
    let userId: string | null = null;
    let evId: string | null = null;
    let assistant: Row = { id: uid(), role: "assistant", content: out.reply, created_at: now() };
    if (!isPrivate && session) {
      userId = uid();
      db.messages.push({ id: userId, session_id: b, role: "user", content: text, request_id: body.request_id, safety_route: out.route, meta: { input: body.input ?? "text" }, created_at: now() });
      if (db.consents.emotion_history && out.route !== "immediate") {
        evId = uid();
        db.emotions.push({ id: evId, message_id: userId, top_label: out.emotion.label, corrected_label: null, dismissed: false, created_at: now(), source: out.emotion.source });
      }
      assistant = { id: uid(), session_id: b, role: "assistant", content: out.reply, request_id: body.request_id, safety_route: out.route, meta: { ...meta, emotion_event_id: evId }, created_at: new Date(Date.now() + 1).toISOString() };
      db.messages.push(assistant);
      if (session.title === "New conversation") session.title = text.split(/\s+/).slice(0, 5).join(" ").replace(/[.,!?]+$/, "");
      session.mode = body.mode;
      session.updated_at = now();
    }
    const proposals = out.proposals.map((p) => {
      const row = { id: uid(), session_id: isPrivate ? null : b, type: p.type, preview: PREVIEW_TEXT[p.type], reason: p.reason, payload: p.payload, status: "pending", expires_at: new Date(Date.now() + PROPOSAL_TTL_MINUTES * 60000).toISOString(), result: null, created_at: now() };
      db.proposals.push(row);
      return row;
    });
    const help = out.showResources || out.route === "immediate";
    return [200, { message: assistant, user_message_id: userId, emotion_event_id: evId, proposals, resources: help ? resourcesFor(String(db.profile.country)) : null, trusted_contacts: help ? db.contacts : [], ...meta }];
  }

  if (a === "audio") throw new HttpError(503, "transcription_unavailable", "Voice transcription runs on the deployed app. In this preview, type instead.");
  if (a === "emotions" && b) return [200, { emotion: Object.assign(byId(db.emotions, b), body) }];

  // proposals
  if (a === "proposals" && !b) {
    for (const p of db.proposals) if (p.status === "pending" && Date.parse(String(p.expires_at)) < Date.now()) p.status = "expired";
    return [200, { proposals: db.proposals.filter((p) => p.status === "pending") }];
  }
  if (a === "proposals" && c === "reject") {
    const p = byId(db.proposals, b);
    if (p.status !== "pending") throw new HttpError(409, "not_pending", "This suggestion was already handled.");
    p.status = "rejected";
    return [200, { proposal: p }];
  }
  if (a === "proposals" && c === "approve") {
    const p = byId(db.proposals, b);
    if (p.status === "approved") return [200, { result: { ...(p.result as object), replayed: true } }];
    if (p.status !== "pending") throw new HttpError(409, "not_pending", "This suggestion was already handled.");
    if (Date.parse(String(p.expires_at)) < Date.now()) {
      p.status = "expired";
      throw new HttpError(409, "expired", "This suggestion expired. Ask again to get a fresh one.");
    }
    const payload = (body.payload ?? p.payload) as Record<string, unknown>;
    let result: Record<string, unknown>;
    if (p.type === "task_plan") {
      const ok = taskPlanPayload.parse(payload);
      const ids = ok.tasks.map((t) => {
        const id = uid();
        db.tasks.push({ id, title: t.title, due_date: t.due_date ?? null, status: "todo", notes: null, source_session_id: p.session_id, source_proposal_id: p.id, completed_at: null, created_at: now() });
        return id;
      });
      result = { ok: true, type: "task_plan", task_ids: ids };
    } else if (p.type === "journal_entry") {
      const ok = journalPayload.parse(payload);
      const id = uid();
      db.journal.push({ id, ...ok, entry_date: today(), source_kind: "ai_proposal", ai_summary: null, ai_summary_source: null, created_at: now(), updated_at: now() });
      result = { ok: true, type: "journal_entry", journal_id: id };
    } else {
      if (!db.consents.memory) throw new HttpError(403, "consent_required", "Turn on memory in Settings to save memories.");
      const ok = memoryPayload.parse(payload);
      const id = uid();
      db.memories.push({ id, ...ok, source_type: "chat_proposal", created_at: now(), updated_at: now() });
      result = { ok: true, type: "memory", memory_id: id };
    }
    Object.assign(p, { status: "approved", payload, result });
    return [200, { result }];
  }

  // generic CRUD collections
  const collections: Record<string, keyof DB> = { checkins: "checkins", journal: "journal", tasks: "tasks", memories: "memories" };
  if (a === "journal" && b === "draft-summary") {
    await sleep(500);
    const e = byId(db.journal, String(body.entry_id));
    const body1 = String(e.body);
    if (body1.length < 40) throw new HttpError(400, "too_short", "Write a little more before asking for a summary.");
    return [200, { draft: `You wrote about: ${body1.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 280)}`, demo: true }];
  }
  if (collections[a]) {
    const list = db[collections[a]] as Row[];
    if (!b && M === "GET") {
      let rows = [...list];
      const q = (query.get("q") ?? "").toLowerCase();
      if (q) rows = rows.filter((r) => `${r.title ?? ""} ${r.body ?? ""} ${r.summary ?? ""}`.toLowerCase().includes(q));
      if (a === "checkins") rows.sort((x, y) => String(y.local_date).localeCompare(String(x.local_date)) || String(y.created_at).localeCompare(String(x.created_at)));
      else if (a === "journal") rows.sort((x, y) => String(y.entry_date).localeCompare(String(x.entry_date)));
      else rows.sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
      const key = a === "journal" ? "entries" : a;
      return [200, a === "memories" ? { memories: rows, enabled: db.consents.memory } : { [key]: rows.slice(0, Number(query.get("limit") ?? 400)) }];
    }
    if (!b && M === "POST") {
      if (a === "memories" && !db.consents.memory) throw new HttpError(403, "consent_required", "Turn on memory to add memories.");
      const row: Row = { id: uid(), tags: [], emotions: [], status: "todo", ...body, created_at: now(), updated_at: now() };
      if (a === "journal") row.entry_date = (body.entry_date as string) ?? today();
      list.push(row);
      const key = { checkins: "checkin", journal: "entry", tasks: "task", memories: "memory" }[a];
      return [201, { [key as string]: row }];
    }
    if (!b && M === "DELETE" && a === "memories") {
      db.memories = [];
      return [200, { ok: true }];
    }
    if (b && M === "PATCH") {
      const row = byId(list, b);
      Object.assign(row, body, { updated_at: now() });
      if (a === "tasks" && body.status) row.completed_at = body.status === "done" ? now() : null;
      const key = { checkins: "checkin", journal: "entry", tasks: "task", memories: "memory" }[a];
      return [200, { [key as string]: row }];
    }
    if (b && M === "GET") return [200, { entry: byId(list, b) }];
    if (b && M === "DELETE") {
      (db[collections[a]] as Row[]) = list.filter((r) => r.id !== b);
      return [200, { ok: true }];
    }
  }

  if (a === "insights") {
    const r = query.get("range") ?? "30d";
    const range: RangeKey = r in RANGES ? (r as RangeKey) : "30d";
    const t = today();
    const weekStart = dateRange(t, 7)[0];
    const rows = db.checkins as unknown as Parameters<typeof buildInsights>[0];
    const ins = buildInsights(rows, t, range);
    const inferred = db.consents.insights && db.consents.emotion_history
      ? { note: "Tentative model inferences, including your corrections.", distribution: distribution(db.emotions.filter((e) => !e.dismissed).map((e) => String(e.corrected_label ?? e.top_label)).filter((l) => l !== "mixed_unknown")), count: db.emotions.length }
      : null;
    const weekRows = rows.filter((x) => x.local_date >= weekStart);
    return [200, {
      ...ins,
      inferred,
      weekly: {
        window: { start: weekStart, end: t },
        checkins: weekRows.length,
        top_tags: distribution(weekRows.flatMap((x) => x.tags ?? []).filter((x) => x !== "sample"), 3),
        completed_tasks: db.tasks.filter((x) => x.status === "done").length,
        helpful_activities: distribution(db.wellness.filter((w) => w.helpful === "yes").map((w) => String(w.activity_id)), 3),
        prompts: ["What is one thing that went okay this week, however small?", "What drained your energy, and what gave you some back?", "Is there one thing you'd like to do a little differently next week?"],
      },
    }];
  }

  if (a === "wellness-sessions") {
    if (!ACTIVITIES.some((x) => x.id === body.activity_id)) throw new HttpError(400, "invalid_input", "Unknown activity.");
    const row = { id: uid(), ...body, created_at: now() };
    db.wellness.push(row);
    return [201, { session: row }];
  }
  if (a === "safety-plan" && M === "GET") return [200, { plan: db.plan, contacts: db.contacts, resources: resourcesFor(String(db.profile.country)) }];
  if (a === "safety-plan" && M === "PUT") {
    db.plan = body as Record<string, string>;
    return [200, { plan: db.plan }];
  }
  if (a === "trusted-contacts" && M === "POST") {
    if (db.contacts.length >= 5) throw new HttpError(400, "limit", "You can save up to 5 trusted contacts.");
    const row = { id: uid(), ...body, created_at: now() };
    db.contacts.push(row);
    return [201, { contact: row }];
  }
  if (a === "trusted-contacts" && b && M === "DELETE") {
    db.contacts = db.contacts.filter((x) => x.id !== b);
    return [200, { ok: true }];
  }
  if (a === "sample-data" && M === "POST") {
    seedSample();
    return [200, { result: { ok: true } }];
  }
  if (a === "sample-data" && M === "DELETE") {
    db.checkins = db.checkins.filter((x) => !(x.tags as string[]).includes("sample"));
    db.journal = db.journal.filter((x) => !(x.tags as string[]).includes("sample"));
    db.tasks = db.tasks.filter((x) => !String(x.title).startsWith("(sample)"));
    return [200, { ok: true }];
  }
  if (a === "export") throw new HttpError(400, "preview", "Downloads are turned off in this preview. Export works on the deployed app.");
  if (a === "account" && M === "DELETE") {
    previewAuth.reset();
    return [200, { ok: true, note: "Preview data cleared. On the deployed app this permanently deletes the account and every record." }];
  }
  throw new HttpError(404, "not_found", `No preview handler for ${M} ${path}`);
}

export function installMockApi() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, "http://preview.local");
    if (!url.pathname.startsWith("/api/v1")) return realFetch(input, init);
    const requestId = uid();
    let body: Record<string, unknown> = {};
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {}
    }
    try {
      const [status, data] = await handle({ method: init?.method ?? "GET", path: url.pathname, query: url.searchParams, body });
      save();
      return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
    } catch (e) {
      const err = e instanceof HttpError ? e : new HttpError(500, "internal_error", "Something went wrong in the preview.");
      if (!(e instanceof HttpError)) console.error(e);
      return new Response(JSON.stringify({ error: { code: err.code, message: err.message, request_id: requestId } }), { status: err.status, headers: { "Content-Type": "application/json" } });
    }
  };
}

export { EMOTION_LABEL };
