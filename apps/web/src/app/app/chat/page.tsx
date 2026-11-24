"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookPlus, EyeOff, LifeBuoy, ListTree, Mic, Pencil, Plus, RotateCcw, Send, ThumbsDown, ThumbsUp, Trash2, Volume2, VolumeX } from "lucide-react";
import { useMe } from "@/components/app-shell";
import { ProposalCard, type Proposal } from "@/components/proposal-card";
import { Recorder } from "@/components/recorder";
import { ResourceList } from "@/components/resources";
import { ReachOut, type TrustedContact } from "@/components/reach-out";
import { Badge, Button, ConfirmButton, ErrorNote, Input, Label, LiveRegion, Modal, Select, Spinner, Textarea, cx } from "@/components/ui";
import { api, newRequestId } from "@/lib/client-api";
import { EMOTIONS, EMOTION_LABEL, MODES, MODE_INFO, type EmotionOrUnknown, type Mode } from "@/lib/constants";
import type { RegionResources } from "@/lib/safety/resources";

type Hint = { label: EmotionOrUnknown; phrase: string } | null;
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  request_id: string;
  status?: "pending" | "failed";
  error?: string;
  input?: "text" | "voice";
  // assistant-only
  route?: string;
  demo?: boolean;
  busy?: boolean;
  resources?: RegionResources | null;
  contacts?: TrustedContact[];
  quickReplies?: string[];
  proposalIds?: string[];
  // user-only
  hint?: Hint;
  emotionEventId?: string | null;
  corrected?: EmotionOrUnknown | null;
  hintDismissed?: boolean;
};
type SessionRow = { id: string; title: string; mode: Mode; updated_at: string };

function ChatInner() {
  const { me } = useMe();
  const router = useRouter();
  const params = useSearchParams();
  const sid = params.get("s");
  const isPrivate = params.get("private") === "1";
  const wantNew = params.get("new") === "1";

  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [title, setTitle] = useState("New conversation");
  const [mode, setMode] = useState<Mode>(me.profile?.default_mode ?? "just_listen");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [proposals, setProposals] = useState<Record<string, Proposal>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selfReport, setSelfReport] = useState<EmotionOrUnknown | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [inputKind, setInputKind] = useState<"text" | "voice">("text");
  const [renaming, setRenaming] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [journalDraft, setJournalDraft] = useState<{ body: string } | null>(null);
  const [feedback, setFeedback] = useState<"none" | "sent">("none");
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const creating = useRef(false);

  const loadSessions = useCallback(async () => {
    try {
      const r = await api<{ sessions: SessionRow[] }>("/sessions");
      setSessions(r.sessions);
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // Create a new stored session when asked.
  useEffect(() => {
    if (!wantNew || creating.current) return;
    creating.current = true;
    api<{ session: SessionRow }>("/sessions", { method: "POST", json: { mode: me.profile?.default_mode ?? "just_listen" } })
      .then((r) => router.replace(`/app/chat?s=${r.session.id}`))
      .catch((e) => setLoadError((e as Error).message))
      .finally(() => (creating.current = false));
  }, [wantNew, me.profile?.default_mode, router]);

  // Load a stored session.
  const loadSession = useCallback(async (id: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await api<{
        session: SessionRow;
        messages: { id: string; role: "user" | "assistant"; content: string; request_id: string; safety_route: string | null; meta: Record<string, unknown>; created_at: string }[];
        proposals: (Proposal & { created_at: string })[];
        emotions: { id: string; corrected_label: EmotionOrUnknown | null; dismissed: boolean }[];
      }>(`/sessions/${id}`);
      setTitle(r.session.title);
      setMode(r.session.mode);
      const emo = new Map(r.emotions.map((e) => [e.id, e]));
      const msgs: Msg[] = [];
      for (const m of r.messages) {
        if (m.role === "user") {
          msgs.push({ id: m.id, role: "user", content: m.content, request_id: m.request_id, input: (m.meta?.input as "text" | "voice") ?? "text" });
        } else {
          const meta = m.meta as { hint?: Hint; emotion_event_id?: string; show_resources?: boolean; quick_replies?: string[]; demo?: boolean; busy?: boolean };
          const prevUser = [...msgs].reverse().find((x) => x.role === "user" && x.request_id === m.request_id);
          if (prevUser) {
            const ev = meta.emotion_event_id ? emo.get(meta.emotion_event_id) : undefined;
            prevUser.hint = meta.hint ?? null;
            prevUser.emotionEventId = meta.emotion_event_id ?? null;
            prevUser.corrected = ev?.corrected_label ?? null;
            prevUser.hintDismissed = ev?.dismissed ?? false;
          }
          msgs.push({ id: m.id, role: "assistant", content: m.content, request_id: m.request_id, route: m.safety_route ?? undefined, demo: meta.demo, busy: meta.busy, quickReplies: [] });
        }
      }
      // Attach proposals to the assistant message closest after them.
      const props: Record<string, Proposal> = {};
      for (const p of r.proposals) props[p.id] = p;
      const assistants = msgs.filter((m) => m.role === "assistant");
      for (const p of r.proposals) {
        const t = new Date(p.created_at).getTime();
        const host = assistants.find((a) => new Date(r.messages.find((x) => x.id === a.id)!.created_at).getTime() >= t - 5000) ?? assistants[assistants.length - 1];
        if (host) host.proposalIds = [...(host.proposalIds ?? []), p.id];
      }
      setProposals(props);
      setMessages(msgs);
      const lastCorrection = [...msgs].reverse().find((m) => m.corrected)?.corrected ?? null;
      setSelfReport(lastCorrection);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setFeedback("none");
    setListOpen(false);
    if (sid) void loadSession(sid);
    else if (isPrivate) {
      setMessages([]);
      setProposals({});
      setTitle("Private conversation");
      setSelfReport(null);
    } else if (!wantNew) {
      setMessages([]);
      setTitle("New conversation");
    }
  }, [sid, isPrivate, wantNew, loadSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  useEffect(() => () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);

  const sessionPath = isPrivate ? "private" : sid;

  const send = async (raw: string, opts: { requestId?: string; retryOf?: string; mode?: Mode } = {}) => {
    const content = raw.trim();
    if (!content || sending || !sessionPath) return;
    const requestId = opts.requestId ?? newRequestId();
    const kind = opts.retryOf ? messages.find((m) => m.id === opts.retryOf)?.input ?? "text" : inputKind;
    const userMsg: Msg = { id: opts.retryOf ?? `local-${requestId}`, role: "user", content, request_id: requestId, status: "pending", input: kind };
    setMessages((prev) => (opts.retryOf ? prev.map((m) => (m.id === opts.retryOf ? userMsg : m)) : [...prev, userMsg]));
    if (!opts.retryOf) setText("");
    setVoiceNote(null);
    setInputKind("text");
    setSending(true);
    setAnnounce("Message sent. Waiting for a reply.");
    try {
      const history = isPrivate
        ? messages.filter((m) => !m.status).slice(-12).map((m) => ({ role: m.role, content: m.content }))
        : undefined;
      const r = await api<{
        message: { id: string; content: string };
        user_message_id: string | null;
        emotion_event_id: string | null;
        proposals: Proposal[];
        resources: RegionResources | null;
        trusted_contacts?: TrustedContact[];
        hint: Hint;
        route: string;
        quick_replies: string[];
        demo: boolean;
        busy?: boolean;
        replayed?: boolean;
      }>(`/sessions/${sessionPath}/messages`, {
        method: "POST",
        json: { text: content, request_id: requestId, mode: opts.mode ?? mode, input: kind, self_report: selfReport, history },
      });
      const props = Object.fromEntries((r.proposals ?? []).map((p) => [p.id, p]));
      setProposals((prev) => ({ ...prev, ...props }));
      setMessages((prev) => [
        ...prev.map((m) =>
          m.request_id === requestId && m.role === "user"
            ? { ...m, id: r.user_message_id ?? m.id, status: undefined, hint: r.hint, emotionEventId: r.emotion_event_id }
            : m,
        ),
        {
          id: r.message.id,
          role: "assistant",
          content: r.message.content,
          request_id: requestId,
          route: r.route,
          demo: r.demo,
          busy: r.busy,
          resources: r.resources,
          contacts: r.trusted_contacts ?? [],
          quickReplies: r.quick_replies ?? [],
          proposalIds: Object.keys(props),
        },
      ]);
      setAnnounce("New reply received.");
      if (!isPrivate && messages.length === 0) {
        void loadSessions().then(async () => {
          if (!sid) return;
          try {
            const s = await api<{ session: SessionRow }>(`/sessions/${sid}`);
            setTitle(s.session.title);
          } catch {}
        });
      }
    } catch (e) {
      // Keep the text so nothing is lost; retry reuses the same request id (idempotent).
      setMessages((prev) => prev.map((m) => (m.request_id === requestId && m.role === "user" ? { ...m, status: "failed", error: (e as Error).message } : m)));
      setAnnounce("Message failed to send.");
    } finally {
      setSending(false);
      taRef.current?.focus();
    }
  };

  const changeMode = async (m: Mode) => {
    setMode(m);
    if (sid) await api(`/sessions/${sid}`, { method: "PATCH", json: { mode: m } }).catch(() => {});
  };

  const correct = async (msg: Msg, label: EmotionOrUnknown | null, dismiss = false) => {
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, corrected: label ?? m.corrected, hintDismissed: dismiss || m.hintDismissed } : m)));
    if (label) setSelfReport(label);
    if (msg.emotionEventId) {
      await api(`/emotions/${msg.emotionEventId}`, { method: "PATCH", json: dismiss ? { dismissed: true } : { corrected_label: label } }).catch(() => {});
    }
  };

  const speak = (m: Msg) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking === m.id) {
      synth.cancel();
      setSpeaking(null);
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(m.content);
    u.onend = () => setSpeaking(null);
    setSpeaking(m.id);
    synth.speak(u);
  };

  const sendFeedback = async (helpful: boolean) => {
    setFeedback("sent");
    await api(`/sessions/${sessionPath}/feedback`, { method: "POST", json: { helpful } }).catch(() => {});
  };

  const rename = async (t: string) => {
    setRenaming(false);
    if (!sid || !t.trim()) return;
    setTitle(t.trim());
    await api(`/sessions/${sid}`, { method: "PATCH", json: { title: t.trim() } }).catch(() => {});
    void loadSessions();
  };

  const deleteSession = async () => {
    if (!sid) return;
    await api(`/sessions/${sid}`, { method: "DELETE" });
    await loadSessions();
    router.replace("/app/chat");
  };

  const assistantCount = messages.filter((m) => m.role === "assistant").length;
  const active = !!sessionPath;

  const sessionList = useMemo(
    () => (
      <div className="flex h-full flex-col">
        <div className="flex gap-2 p-3">
          <Link href="/app/chat?new=1" className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-teal text-sm font-medium text-white hover:bg-teal-dark"><Plus className="size-4" aria-hidden /> New</Link>
          <Link href="/app/chat?private=1" title="Private: not saved" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-line px-3 text-sm font-medium text-ink-soft hover:border-teal/50"><EyeOff className="size-4" aria-hidden /> Private</Link>
        </div>
        <nav aria-label="Conversations" className="flex-1 overflow-y-auto px-2 pb-3">
          {sessions === null ? <div className="p-3"><Spinner /></div> : sessions.length === 0 ? <p className="px-3 text-sm text-muted">No saved conversations yet.</p> : (
            <ul className="space-y-0.5">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link href={`/app/chat?s=${s.id}`} aria-current={s.id === sid ? "page" : undefined} className={cx("block truncate rounded-lg px-3 py-2 text-sm", s.id === sid ? "bg-teal-soft font-medium text-teal-dark" : "text-ink-soft hover:bg-canvas")}>{s.title}</Link>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </div>
    ),
    [sessions, sid],
  );

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] lg:h-dvh">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface/50 md:block">{sessionList}</aside>

      <section className="flex min-w-0 flex-1 flex-col" aria-label="Conversation">
        <header className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas/80 px-4 py-2.5">
          <button className="rounded-lg p-1.5 text-ink-soft hover:bg-teal-soft md:hidden" onClick={() => setListOpen(true)} aria-label="Show conversations"><ListTree className="size-5" /></button>
          <div className="min-w-0 flex-1 basis-40">
            {renaming && sid ? (
              <form onSubmit={(e) => { e.preventDefault(); void rename(new FormData(e.currentTarget).get("t") as string); }}>
                <Input name="t" defaultValue={title} autoFocus maxLength={120} onBlur={(e) => rename(e.target.value)} aria-label="Conversation name" className="h-8" />
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="truncate font-sans text-base font-semibold">{active ? title : "Conversations"}</h1>
                {sid && <button onClick={() => setRenaming(true)} className="text-muted hover:text-ink" aria-label="Rename conversation"><Pencil className="size-3.5" /></button>}
                {isPrivate && <Badge tone="grey"><EyeOff className="size-3" aria-hidden /> Private · not saved</Badge>}
                {me.demo.llm && <Badge tone="sand">Demo mode</Badge>}
              </div>
            )}
          </div>
          {active && (
            <>
              <label htmlFor="mode" className="sr-only">Conversation mode</label>
              <div className="w-40 sm:w-44">
                <Select id="mode" value={mode} onChange={(e) => changeMode(e.target.value as Mode)} className="h-9 py-1 text-sm">
                  {MODES.map((m) => <option key={m} value={m}>{MODE_INFO[m].label}</option>)}
                </Select>
              </div>
              {sid && <ConfirmButton onConfirm={deleteSession} confirmLabel="Delete chat"><Trash2 className="size-4" aria-hidden /><span className="sr-only">Delete conversation</span></ConfirmButton>}
            </>
          )}
          <Link href="/app/safety" className="hidden items-center gap-1 rounded-full bg-rose-soft px-3 py-1.5 text-xs font-semibold text-rose-ink lg:inline-flex"><LifeBuoy className="size-3.5" aria-hidden /> Help</Link>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="mx-auto max-w-2xl space-y-4">
            {!active && !wantNew && (
              <div className="py-10 text-center">
                <h2 className="text-2xl font-semibold">Start where you are</h2>
                <p className="mx-auto mt-2 max-w-md text-ink-soft">A saved conversation keeps your history. A private one is never stored and won&apos;t feed memory, journal or insights.</p>
                <div className="mt-6 flex justify-center gap-2">
                  <Link href="/app/chat?new=1" className="inline-flex h-11 items-center gap-2 rounded-full bg-teal px-5 font-medium text-white hover:bg-teal-dark"><Plus className="size-4" aria-hidden /> New conversation</Link>
                  <Link href="/app/chat?private=1" className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-5 font-medium hover:border-teal/50"><EyeOff className="size-4" aria-hidden /> Private</Link>
                </div>
              </div>
            )}
            {(wantNew || loading) && <Spinner label="Opening conversation" />}
            {loadError && <ErrorNote message={loadError} onRetry={sid ? () => loadSession(sid) : undefined} />}
            {isPrivate && messages.length === 0 && (
              <p className="rounded-xl bg-surface p-4 text-sm text-ink-soft">This private conversation isn&apos;t saved. It disappears when you leave this page. Messages are still sent to the AI provider to generate replies.</p>
            )}
            {active && !loading && messages.length === 0 && (
              <div className="rounded-2xl border border-line bg-surface p-5">
                <p className="font-medium">{MODE_INFO[mode].label}</p>
                <p className="text-sm text-ink-soft">{MODE_INFO[mode].blurb}. Change the mode any time above.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["I've had a rough day and need to vent", "I'm overwhelmed by everything I have to do", "Something good happened today!"].map((s) => (
                    <button key={s} onClick={() => setText(s)} className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-teal/50">{s}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex flex-col items-end">
                  <div className={cx("max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md px-4 py-2.5", m.status === "failed" ? "border border-rose-ink/30 bg-rose-soft text-ink" : "bg-ink text-white", m.status === "pending" && "opacity-70")}>
                    {m.input === "voice" && <Mic className="mb-0.5 mr-1 inline size-3.5 opacity-70" aria-label="Voice message" />}
                    {m.content}
                  </div>
                  {m.status === "failed" && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-rose-ink">
                      <span>{m.error ?? "Not sent."}</span>
                      <button className="inline-flex items-center gap-1 font-medium underline" onClick={() => send(m.content, { requestId: m.request_id, retryOf: m.id })}><RotateCcw className="size-3" aria-hidden /> Retry</button>
                    </div>
                  )}
                  {!m.status && m.hint && !m.hintDismissed && (
                    <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5 text-xs text-muted">
                      {m.corrected ? (
                        <span>Noted: you&apos;re feeling <span className="font-medium text-ink">{EMOTION_LABEL[m.corrected]}</span></span>
                      ) : (
                        <span>{m.hint.phrase} <span className="font-medium text-ink">{EMOTION_LABEL[m.hint.label]}</span>.</span>
                      )}
                      <label className="sr-only" htmlFor={`fix-${m.id}`}>Change how you&apos;re feeling</label>
                      <select id={`fix-${m.id}`} className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs" value="" onChange={(e) => e.target.value && correct(m, e.target.value as EmotionOrUnknown)}>
                        <option value="">{m.corrected ? "change" : "not quite?"}</option>
                        {[...EMOTIONS, "mixed_unknown" as const].map((e) => <option key={e} value={e}>{EMOTION_LABEL[e]}</option>)}
                      </select>
                      <button className="underline" onClick={() => correct(m, null, true)}>dismiss</button>
                    </div>
                  )}
                  {!m.status && !isPrivate && sid && (
                    <button onClick={() => setJournalDraft({ body: m.content })} className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-teal"><BookPlus className="size-3" aria-hidden /> Save to journal</button>
                  )}
                </div>
              ) : (
                <div key={m.id} className="flex flex-col items-start">
                  <div className={cx("max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-md px-4 py-2.5", m.route === "immediate" || m.route === "concern" ? "border border-rose-ink/20 bg-surface" : "bg-surface border border-line")}>
                    {m.content}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                    {m.demo && <span>Demo mode reply</span>}
                    {m.busy && <span>The AI is busy right now, so this is a simpler reply. Try again in a minute.</span>}
                    {me.profile?.voice_output && typeof window !== "undefined" && "speechSynthesis" in window && (
                      <button onClick={() => speak(m)} className="inline-flex items-center gap-1 hover:text-teal" aria-label={speaking === m.id ? "Stop reading aloud" : "Read aloud"}>
                        {speaking === m.id ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />} {speaking === m.id ? "Stop" : "Listen"}
                      </button>
                    )}
                  </div>
                  {m.resources && (
                    <div className="mt-2 w-full max-w-xl rounded-2xl border border-rose-ink/20 bg-rose-soft/50 p-4">
                      <p className="mb-3 font-medium text-rose-ink">Talk to a person</p>
                      {m.contacts && m.contacts.length > 0 && <div className="mb-3"><ReachOut contacts={m.contacts} /></div>}
                      <ResourceList region={m.resources} compact />
                      {(!m.contacts || m.contacts.length === 0) && (
                        <p className="mt-2 text-xs text-muted">Tip: add someone you trust in the <Link href="/app/safety" className="text-teal underline">Safety centre</Link> to reach them here in one tap.</p>
                      )}
                    </div>
                  )}
                  {(m.proposalIds ?? []).map((pid) => proposals[pid] && (
                    <ProposalCard key={pid} proposal={proposals[pid]} onChange={(p) => setProposals((prev) => ({ ...prev, [p.id]: p }))} />
                  ))}
                  {m.quickReplies && m.quickReplies.length > 0 && m.id === messages[messages.length - 1]?.id && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.quickReplies.map((q) => (
                        <button key={q} onClick={() => { const next: Mode = q.includes("calm") ? "calm_me_down" : q.includes("think") ? "help_me_think" : "just_listen"; void changeMode(next); void send(q, { mode: next }); }} className="rounded-full border border-teal/40 bg-surface px-3 py-1.5 text-sm text-teal-dark hover:bg-teal-soft">{q}</button>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
            {sending && (
              <div className="flex items-center gap-2 text-sm text-muted" role="status"><span className="inline-flex gap-1"><span className="size-1.5 animate-bounce rounded-full bg-teal" /><span className="size-1.5 animate-bounce rounded-full bg-teal [animation-delay:120ms]" /><span className="size-1.5 animate-bounce rounded-full bg-teal [animation-delay:240ms]" /></span> Thinking…</div>
            )}
            {assistantCount >= 2 && !sending && (
              <div className="pt-2 text-center text-xs text-muted">
                {feedback === "sent" ? "Thanks for the feedback." : (
                  <span className="inline-flex items-center gap-2">Was this conversation helpful?
                    <button onClick={() => sendFeedback(true)} className="rounded-full p-1 hover:bg-teal-soft" aria-label="Yes, helpful"><ThumbsUp className="size-4" /></button>
                    <button onClick={() => sendFeedback(false)} className="rounded-full p-1 hover:bg-teal-soft" aria-label="Not helpful"><ThumbsDown className="size-4" /></button>
                  </span>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {active && (
          <div className="border-t border-line bg-canvas px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
            <div className="mx-auto max-w-2xl">
              {voiceNote && <p className="mb-2 text-xs text-sand-dark">{voiceNote}</p>}
              <form
                onSubmit={(e) => { e.preventDefault(); void send(text); }}
                className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 focus-within:border-teal"
              >
                <label htmlFor="composer" className="sr-only">Message</label>
                <textarea
                  id="composer"
                  ref={taRef}
                  rows={1}
                  value={text}
                  maxLength={4000}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void send(text);
                    }
                  }}
                  placeholder={inputKind === "voice" ? "Check the transcript, then send" : "What's on your mind?"}
                  className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 focus:outline-none"
                  style={{ height: "auto" }}
                  onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = `${Math.min(t.scrollHeight, 160)}px`; }}
                />
                <Button type="button" variant="ghost" size="md" onClick={() => setRecording(true)} aria-label="Record a voice message" disabled={sending}><Mic className="size-5" /></Button>
                <Button type="submit" size="md" disabled={!text.trim() || sending} aria-label="Send"><Send className="size-4" /></Button>
              </form>
              <p className="mt-1.5 text-center text-[11px] text-muted">AI can misread feelings. Enter to send, Shift+Enter for a new line.</p>
            </div>
          </div>
        )}
      </section>

      <Modal open={recording} onClose={() => setRecording(false)} title="Voice message">
        {me.consents.voice_processing ? (
          <Recorder
            onCancel={() => setRecording(false)}
            onTranscript={(t, info) => {
              setRecording(false);
              setText((prev) => (prev ? `${prev} ${t}` : t));
              setInputKind("voice");
              setVoiceNote(info.demo ? info.note : info.lowConfidence ? "The recording was unclear, so please check the transcript carefully." : "Check the transcript, edit if needed, then send.");
              setTimeout(() => taRef.current?.focus(), 50);
            }}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-ink-soft">Voice transcription is turned off. Turn it on in Settings to record messages. Typing always works.</p>
            <Link href="/app/settings" className="font-medium text-teal underline">Open Settings</Link>
          </div>
        )}
      </Modal>

      <JournalModal draft={journalDraft} sessionId={sid} onClose={() => setJournalDraft(null)} />

      {listOpen && (
        <div className="fixed inset-0 z-40 bg-ink/30 md:hidden" onClick={() => setListOpen(false)}>
          <div className="absolute inset-y-0 left-0 w-72 bg-surface shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Conversations">{sessionList}</div>
        </div>
      )}
      <LiveRegion message={announce} />
    </div>
  );
}

function JournalModal({ draft, sessionId, onClose }: { draft: { body: string } | null; sessionId: string | null; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (draft) {
      setBody(draft.body);
      setTitle("");
      setSaved(false);
      setError(null);
    }
  }, [draft]);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/journal", { method: "POST", json: { title, body, source_kind: "chat", source_session_id: sessionId } });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={!!draft} onClose={onClose} title="Save to journal">
      {saved ? (
        <div className="space-y-3">
          <p>Saved to your journal.</p>
          <div className="flex gap-2"><Link href="/app/journal" className="font-medium text-teal underline">Open journal</Link><Button variant="ghost" size="sm" onClick={onClose}>Close</Button></div>
        </div>
      ) : (
        <div className="space-y-3">
          <div><Label htmlFor="jt" hint="(optional)">Title</Label><Input id="jt" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label htmlFor="jb">Entry</Label><Textarea id="jb" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-40" /></div>
          <p className="text-xs text-muted">Edit freely. Nothing is saved until you press Save.</p>
          {error && <ErrorNote message={error} />}
          <div className="flex gap-2"><Button onClick={save} loading={busy} disabled={!body.trim()}>Save</Button><Button variant="ghost" onClick={onClose}>Cancel</Button></div>
        </div>
      )}
    </Modal>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-8"><Spinner /></div>}>
      <ChatInner />
    </Suspense>
  );
}
