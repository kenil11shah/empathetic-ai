"use client";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Lightbulb, Mic, Search, Sparkles } from "lucide-react";
import { useMe } from "@/components/app-shell";
import { Recorder } from "@/components/recorder";
import { Badge, Button, Card, ConfirmButton, EmptyState, ErrorNote, Input, Label, Modal, PageHeader, Skeleton, Textarea } from "@/components/ui";
import { api, localDateISO } from "@/lib/client-api";

type Entry = { id: string; title: string; body: string; tags: string[]; entry_date: string; source_kind: string; ai_summary: string | null; ai_summary_source: string | null; updated_at: string };

const PROMPTS = [
  "What's taking up the most space in your mind today?",
  "What is one thing you handled better than you expected recently?",
  "What do you need more of this week, and what do you need less of?",
  "Describe a moment today when you felt even a little at ease.",
  "If a good friend were in your situation, what would you say to them?",
  "What's something you're looking forward to, however small?",
];

export default function JournalPage() {
  const { me } = useMe();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | "new" | null>(null);

  const load = useCallback(async (query = "") => {
    setError(null);
    try {
      setEntries((await api<{ entries: Entry[] }>(`/journal${query ? `?q=${encodeURIComponent(query)}` : ""}`)).entries);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => void load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  if (editing)
    return (
      <Editor
        entry={editing === "new" ? null : editing}
        voiceEnabled={me.consents.voice_processing}
        onDone={(saved) => { setEditing(null); if (saved) void load(q); }}
      />
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Journal" subtitle="Private notes, written or dictated. Only you can see them." actions={<Button onClick={() => setEditing("new")}>New entry</Button>} />
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="jsearch" className="sr-only">Search journal</label>
        <Input id="jsearch" placeholder="Search your entries" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      {error && <ErrorNote message={error} onRetry={() => load(q)} />}
      {!entries ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : entries.length === 0 ? (
        q ? <p className="text-ink-soft">No entries match &ldquo;{q}&rdquo;.</p> : (
          <EmptyState icon={<BookOpen className="size-8" />} title="Your journal is empty" action={<Button onClick={() => setEditing("new")}>Write your first entry</Button>}>
            Write as much or as little as you like. A prompt is there if you want one.
          </EmptyState>
        )
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => (
            <li key={e.id}>
              <button onClick={() => setEditing(e)} className="block w-full text-left">
                <Card className="transition-colors hover:border-teal/40">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-sans text-lg font-semibold">{e.title || "Untitled"}</h2>
                    <span className="text-xs text-muted">{e.entry_date}</span>
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-ink-soft">{e.body}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {e.source_kind !== "manual" && <Badge tone="grey">{e.source_kind === "voice" ? "dictated" : e.source_kind === "chat" ? "from chat" : "AI-drafted, approved"}</Badge>}
                    {e.ai_summary && <Badge><Sparkles className="size-3" aria-hidden /> summary</Badge>}
                    {e.tags.map((t) => <Badge key={t} tone="grey">#{t}</Badge>)}
                  </div>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Editor({ entry, voiceEnabled, onDone }: { entry: Entry | null; voiceEnabled: boolean; onDone: (saved: boolean) => void }) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [body, setBody] = useState(entry?.body ?? "");
  const [tags, setTags] = useState((entry?.tags ?? []).join(", "));
  const [date, setDate] = useState(entry?.entry_date ?? localDateISO());
  const [summary, setSummary] = useState(entry?.ai_summary ?? "");
  const [draft, setDraft] = useState<string | null>(null);
  const [draftDemo, setDraftDemo] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [id, setId] = useState(entry?.id ?? null);
  const storageKey = `journal-draft-${entry?.id ?? "new"}`;

  // Recover an unsaved draft after a transient error or reload (kept in this browser only).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved && !entry) {
        const d = JSON.parse(saved) as { title: string; body: string };
        setTitle(d.title);
        setBody(d.body);
      }
    } catch {}
  }, [storageKey, entry]);
  useEffect(() => {
    try {
      if (body || title) sessionStorage.setItem(storageKey, JSON.stringify({ title, body }));
    } catch {}
  }, [title, body, storageKey]);

  const save = async () => {
    setBusy("save");
    setError(null);
    const payload = {
      title,
      body,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12),
      entry_date: date,
      ...(id ? {} : { source_kind: usedVoice ? "voice" : "manual" }),
    };
    try {
      if (id) await api(`/journal/${id}`, { method: "PATCH", json: payload });
      else setId((await api<{ entry: Entry }>("/journal", { method: "POST", json: payload })).entry.id);
      try { sessionStorage.removeItem(storageKey); } catch {}
      onDone(true);
    } catch (e) {
      setError(`${(e as Error).message} Your text is kept here so you can try again.`);
    } finally {
      setBusy(null);
    }
  };

  const requestSummary = async () => {
    if (!id) return;
    setBusy("summary");
    setError(null);
    try {
      const r = await api<{ draft: string; demo: boolean }>("/journal/draft-summary", { method: "POST", json: { entry_id: id } });
      setDraft(r.draft);
      setDraftDemo(r.demo);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveSummary = async () => {
    if (!id || draft === null) return;
    setBusy("saveSummary");
    try {
      await api(`/journal/${id}`, { method: "PATCH", json: { ai_summary: draft, ai_summary_source: draftDemo ? "demo-extract, reviewed by user" : "ai-draft, reviewed by user" } });
      setSummary(draft);
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => onDone(false)}>← Back</Button>
        {id && <ConfirmButton onConfirm={async () => { await api(`/journal/${id}`, { method: "DELETE" }); try { sessionStorage.removeItem(storageKey); } catch {} onDone(true); }}>Delete entry</ConfirmButton>}
      </div>
      <Card>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div><Label htmlFor="title" hint="(optional)">Title</Label><Input id="title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label htmlFor="date">Date</Label><Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        {prompt && <p className="mt-4 rounded-xl bg-sand px-4 py-3 text-sm text-sand-dark"><Lightbulb className="mr-1 inline size-4" aria-hidden />{prompt}</p>}
        <div className="mt-4">
          <Label htmlFor="body">Entry</Label>
          <Textarea id="body" value={body} maxLength={20000} onChange={(e) => setBody(e.target.value)} className="min-h-64 leading-relaxed" placeholder="Start anywhere…" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)])}><Lightbulb className="size-4" aria-hidden /> Reflection prompt</Button>
          <Button variant="ghost" size="sm" onClick={() => setRecording(true)}><Mic className="size-4" aria-hidden /> Dictate</Button>
        </div>
        <div className="mt-4"><Label htmlFor="tags" hint="(comma separated)">Tags</Label><Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} /></div>
        {error && <div className="mt-4"><ErrorNote message={error} /></div>}
        <div className="mt-5 flex gap-2">
          <Button onClick={save} loading={busy === "save"} disabled={!body.trim() && !title.trim()}>Save entry</Button>
          <Button variant="ghost" onClick={() => onDone(false)}>Cancel</Button>
        </div>
      </Card>

      {id && (
        <Card className="mt-4">
          <h2 className="flex items-center gap-2 font-sans text-lg font-semibold"><Sparkles className="size-5 text-teal" aria-hidden /> Summary</h2>
          {summary && draft === null && (
            <div className="mt-2">
              <p className="text-ink-soft">{summary}</p>
              <p className="mt-1 text-xs text-muted">AI-generated draft you reviewed. Your original entry is unchanged.</p>
            </div>
          )}
          {draft !== null ? (
            <div className="mt-3 space-y-2">
              <Label htmlFor="draft">Draft summary (edit before saving)</Label>
              <Textarea id="draft" value={draft} onChange={(e) => setDraft(e.target.value)} />
              {draftDemo && <p className="text-xs text-sand-dark">Demo mode: this is a simple extract, not an AI summary.</p>}
              <div className="flex gap-2"><Button size="sm" onClick={saveSummary} loading={busy === "saveSummary"}>Save summary</Button><Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Discard</Button></div>
            </div>
          ) : (
            <Button className="mt-3" size="sm" variant="secondary" onClick={requestSummary} loading={busy === "summary"}>{summary ? "Draft a new summary" : "Draft a summary"}</Button>
          )}
        </Card>
      )}

      <Modal open={recording} onClose={() => setRecording(false)} title="Dictate">
        {voiceEnabled ? (
          <Recorder onCancel={() => setRecording(false)} onTranscript={(t) => { setRecording(false); if (t) { setBody((b) => (b ? `${b}\n${t}` : t)); setUsedVoice(true); } }} />
        ) : (
          <p className="text-ink-soft">Voice transcription is off. You can turn it on in Settings.</p>
        )}
      </Modal>
    </div>
  );
}
