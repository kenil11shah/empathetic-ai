"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Download, LogOut, Search } from "lucide-react";
import { useMe } from "@/components/app-shell";
import { Badge, Button, Card, ConfirmButton, ErrorNote, Input, Label, PageHeader, Select, Toggle } from "@/components/ui";
import { api } from "@/lib/client-api";
import { CONSENT_INFO, COUNTRIES, MODES, MODE_INFO, type ConsentType, type Mode } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

const PREVIEW = process.env.NEXT_PUBLIC_PREVIEW === "1";

type Memory = { id: string; summary: string; category: string; source_type: string; created_at: string };

export default function SettingsPage() {
  const { me, refresh } = useMe();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (m: string) => {
    setNotice(m);
    setTimeout(() => setNotice(null), 3000);
  };

  const patchProfile = async (patch: Record<string, unknown>) => {
    setError(null);
    try {
      await api("/me", { method: "PATCH", json: patch });
      await refresh();
      flash("Saved.");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const setConsent = async (c: ConsentType, granted: boolean) => {
    setError(null);
    try {
      await api("/consents", { method: "PUT", json: { consents: [{ consent_type: c, granted }] } });
      await refresh();
      flash(granted ? "Turned on." : "Turned off.");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Settings" subtitle="Your account, privacy choices and data." />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      {notice && <p role="status" className="mb-4 rounded-xl bg-teal-soft px-4 py-2 text-sm text-teal-dark">{notice}</p>}

      <Card>
        <h2 className="font-sans text-lg font-semibold">Profile</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="dn">Name</Label>
            <Input id="dn" defaultValue={me.profile?.display_name ?? ""} maxLength={80} onBlur={(e) => e.target.value !== (me.profile?.display_name ?? "") && patchProfile({ display_name: e.target.value || null })} />
          </div>
          <div>
            <Label htmlFor="ct">Country (for help resources)</Label>
            <Select id="ct" value={me.profile?.country ?? "OTHER"} onChange={(e) => patchProfile({ country: e.target.value })}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="dm">Default conversation mode</Label>
            <Select id="dm" value={me.profile?.default_mode ?? "just_listen"} onChange={(e) => patchProfile({ default_mode: e.target.value as Mode })}>
              {MODES.map((m) => <option key={m} value={m}>{MODE_INFO[m].label}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="tz">Time zone</Label>
            <Input id="tz" defaultValue={me.profile?.timezone ?? "UTC"} onBlur={(e) => e.target.value && e.target.value !== me.profile?.timezone && patchProfile({ timezone: e.target.value })} />
          </div>
        </div>
        <div className="mt-2 border-t border-line">
          <Toggle id="tts" label="Read replies aloud" description="Adds a Listen button to replies, using your browser's built-in voice. Off by default." checked={!!me.profile?.voice_output} onChange={(v) => patchProfile({ voice_output: v })} />
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="font-sans text-lg font-semibold">Privacy choices</h2>
        <p className="text-sm text-ink-soft">Each is separate. Turning any off never blocks chatting.</p>
        <div className="mt-2 divide-y divide-line">
          {(Object.keys(CONSENT_INFO) as ConsentType[]).filter((c) => c !== "research").map((c) => (
            <Toggle key={c} id={`s-${c}`} label={CONSENT_INFO[c].label} description={CONSENT_INFO[c].detail + (c === "emotion_history" ? " Turning this off deletes stored hints." : "")} checked={me.consents[c]} onChange={(v) => setConsent(c, v)} />
          ))}
          <div className="py-3 text-sm text-muted">Research participation: not used in this prototype.</div>
        </div>
      </Card>

      <MemoryManager enabled={me.consents.memory} onToggle={(v) => setConsent("memory", v)} />

      <AccountCard isGuest={me.user.is_guest} email={me.user.email} />

      <Card className="mt-4">
        <h2 className="font-sans text-lg font-semibold">Your data</h2>
        <p className="text-sm text-ink-soft">Download everything stored for your account.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <form method="post" action="/api/v1/export?format=json" onSubmit={(e) => { if (PREVIEW) { e.preventDefault(); flash("Downloads are off in the preview. Export works on the deployed app."); } }}><Button type="submit" variant="secondary"><Download className="size-4" aria-hidden /> Export JSON</Button></form>
          <form method="post" action="/api/v1/export?format=text" onSubmit={(e) => { if (PREVIEW) { e.preventDefault(); flash("Downloads are off in the preview. Export works on the deployed app."); } }}><Button type="submit" variant="secondary"><Download className="size-4" aria-hidden /> Export readable text</Button></form>
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <p className="font-medium">Sample data</p>
          <p className="text-sm text-ink-soft">Adds synthetic check-ins, journal entries and tasks (all tagged &ldquo;sample&rdquo;) so you can explore Insights. Remove them any time.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="soft" onClick={async () => { try { await api("/sample-data", { method: "POST" }); flash("Sample data added. Open Insights to explore."); } catch (e) { setError((e as Error).message); } }}>Add sample data</Button>
            <Button size="sm" variant="ghost" onClick={async () => { try { await api("/sample-data", { method: "DELETE" }); flash("Sample data removed."); } catch (e) { setError((e as Error).message); } }}>Remove sample data</Button>
          </div>
        </div>
      </Card>

      <DeleteAccount disabled={me.demo.accountDeletion && !PREVIEW} />

      <div className="mt-6 flex justify-end">
        <Button variant="ghost" onClick={signOut}><LogOut className="size-4" aria-hidden /> Sign out</Button>
      </div>
    </div>
  );
}

function MemoryManager({ enabled, onToggle }: { enabled: boolean; onToggle: (v: boolean) => void }) {
  const [items, setItems] = useState<Memory[] | null>(null);
  const [q, setQ] = useState("");
  const [newMem, setNewMem] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await api<{ memories: Memory[] }>(`/memories${q ? `?q=${encodeURIComponent(q)}` : ""}`)).memories);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [q]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api<{ memory: Memory }>("/memories", { method: "POST", json: { summary: newMem, category: "preference" } });
      setItems((x) => [r.memory, ...(x ?? [])]);
      setNewMem("");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Card className="mt-4">
      <div id="memory" className="scroll-mt-20" />
      <h2 className="flex items-center gap-2 font-sans text-lg font-semibold"><Brain className="size-5 text-teal" aria-hidden /> What the AI knows about me</h2>
      <p className="text-sm text-ink-soft">Only things you approved. Retrieved memories are treated as information, never as instructions.</p>
      <Toggle id="mem-toggle" label="Memory" description={enabled ? "On: new memories can be suggested and used in saved chats." : "Off: nothing new is saved or used. Existing items stay until you delete them."} checked={enabled} onChange={onToggle} />
      {error && <ErrorNote message={error} />}
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="msearch" className="sr-only">Search memories</label>
        <Input id="msearch" className="pl-9" placeholder="Search memories" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="mt-3 space-y-2">
        {items?.length === 0 && <li className="text-sm text-muted">Nothing saved.</li>}
        {items?.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-canvas px-3 py-2">
            {editing === m.id ? (
              <form className="flex flex-1 gap-2" onSubmit={async (e) => { e.preventDefault(); const s = String(new FormData(e.currentTarget).get("s")); await api(`/memories/${m.id}`, { method: "PATCH", json: { summary: s } }); setItems((x) => x!.map((y) => (y.id === m.id ? { ...y, summary: s } : y))); setEditing(null); }}>
                <Input name="s" defaultValue={m.summary} maxLength={400} aria-label="Memory text" />
                <Button size="sm" type="submit">Save</Button>
              </form>
            ) : (
              <>
                <span className="flex-1 text-sm">{m.summary}</span>
                <Badge tone="grey">{m.source_type === "chat_proposal" ? "approved in chat" : "added by you"}</Badge>
                <Button variant="ghost" size="sm" onClick={() => setEditing(m.id)}>Edit</Button>
                <ConfirmButton onConfirm={async () => { await api(`/memories/${m.id}`, { method: "DELETE" }); setItems((x) => x!.filter((y) => y.id !== m.id)); }}>Delete</ConfirmButton>
              </>
            )}
          </li>
        ))}
      </ul>
      {enabled && (
        <form onSubmit={add} className="mt-3 flex gap-2">
          <label htmlFor="newmem" className="sr-only">Add a memory</label>
          <Input id="newmem" placeholder='e.g. "I prefer short replies"' value={newMem} maxLength={400} onChange={(e) => setNewMem(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={!newMem.trim()}>Add</Button>
        </form>
      )}
      {!!items?.length && (
        <div className="mt-3">
          <ConfirmButton confirmLabel="Clear all memories" onConfirm={async () => { await api("/memories", { method: "DELETE" }); setItems([]); }}>Clear all</ConfirmButton>
        </div>
      )}
    </Card>
  );
}

function AccountCard({ isGuest, email }: { isGuest: boolean; email: string | null }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setErr(error.message);
    else setMsg(ok);
  };

  return (
    <Card className="mt-4">
      <h2 className="font-sans text-lg font-semibold">Account</h2>
      {isGuest ? (
        <>
          <p className="text-sm text-ink-soft">You&apos;re using a guest account. Guest accounts and their data are deleted after 30 days. Add an email and password to keep yours and sign in again later.</p>
          <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => createClient().auth.updateUser({ email: newEmail }), "Check your email to confirm. Then set a password below."); }}>
            <label htmlFor="ue" className="sr-only">Email</label>
            <Input id="ue" type="email" required placeholder="you@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="flex-1" />
            <Button type="submit" variant="secondary" loading={busy}>Save account</Button>
          </form>
        </>
      ) : (
        <p className="text-sm text-ink-soft">Signed in as {email}</p>
      )}
      <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => createClient().auth.updateUser({ password }), "Password updated."); setPassword(""); }}>
        <label htmlFor="np" className="sr-only">New password</label>
        <Input id="np" type="password" minLength={8} autoComplete="new-password" placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1" />
        <Button type="submit" variant="secondary" disabled={password.length < 8} loading={busy}>Set password</Button>
      </form>
      {msg && <p role="status" className="mt-2 text-sm text-teal-dark">{msg}</p>}
      {err && <p role="alert" className="mt-2 text-sm text-rose-ink">{err}</p>}
    </Card>
  );
}

function DeleteAccount({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const del = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ note: string }>("/account", { method: "DELETE", json: { confirm } });
      setDone(r.note);
      setTimeout(() => (PREVIEW ? router.replace("/") : (window.location.href = "/")), 3500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-4 border-rose-ink/20">
      <h2 className="font-sans text-lg font-semibold text-rose-ink">Delete account</h2>
      {done ? (
        <p role="status" className="mt-2 text-ink-soft">{done}</p>
      ) : (
        <>
          <p className="text-sm text-ink-soft">Permanently deletes your account and all conversations, journal entries, check-ins, tasks, memories and safety plan. This can&apos;t be undone.</p>
          {disabled && <p className="mt-2 text-sm text-sand-dark">Account deletion isn&apos;t configured on this deployment yet (needs the server secret key).</p>}
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="del">Type DELETE to confirm</Label>
              <Input id="del" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button variant="danger" onClick={del} loading={busy} disabled={confirm !== "DELETE" || disabled}>Delete my account</Button>
          </div>
          {error && <div className="mt-3"><ErrorNote message={error} /></div>}
        </>
      )}
    </Card>
  );
}
