"use client";
import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, UserPlus } from "lucide-react";
import { ResourceList } from "@/components/resources";
import { ReachOut } from "@/components/reach-out";
import { Button, Card, ConfirmButton, ErrorNote, Input, Label, PageHeader, Skeleton, Textarea } from "@/components/ui";
import { api } from "@/lib/client-api";
import type { RegionResources } from "@/lib/safety/resources";

type Plan = { warning_signs: string; coping_steps: string; reasons: string; safe_places: string; professional_contacts: string };
type Contact = { id: string; name: string; email: string | null; phone: string | null; relationship: string | null; note: string | null };
const EMPTY: Plan = { warning_signs: "", coping_steps: "", reasons: "", safe_places: "", professional_contacts: "" };
const FIELDS: [keyof Plan, string, string][] = [
  ["warning_signs", "Signs things are getting harder", "Thoughts, feelings or situations that tell me I need support"],
  ["coping_steps", "Things I can do on my own", "Activities that help me feel even slightly better"],
  ["safe_places", "People and places that help me feel safer", "Somewhere I can go, someone I can be around"],
  ["reasons", "What matters to me", "People, plans, pets, values, things I'm looking forward to"],
  ["professional_contacts", "Professional contacts", "Doctor, counsellor, campus service, local crisis line"],
];

export default function SafetyPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [resources, setResources] = useState<RegionResources | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [c, setC] = useState({ name: "", email: "", phone: "", relationship: "" });

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api<{ plan: Plan | null; contacts: Contact[]; resources: RegionResources }>("/safety-plan");
      setPlan(r.plan ?? EMPTY);
      setContacts(r.contacts);
      setResources(r.resources);
    } catch (e) {
      setError((e as Error).message);
      setPlan(EMPTY);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!plan) return;
    setSaving(true);
    setError(null);
    try {
      await api("/safety-plan", { method: "PUT", json: plan });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const addContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api<{ contact: Contact }>("/trusted-contacts", { method: "POST", json: { name: c.name, email: c.email || null, phone: c.phone || null, relationship: c.relationship || null } });
      setContacts((x) => [...x, r.contact]);
      setC({ name: "", email: "", phone: "", relationship: "" });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Safety centre" subtitle="Help is always here. Nothing on this page is ever sent to anyone automatically." />
      <Card className="border-rose-ink/20">
        <h2 className="mb-3 flex items-center gap-2 font-sans text-lg font-semibold"><ShieldAlert className="size-5 text-rose-ink" aria-hidden /> Talk to someone now</h2>
        {resources ? <ResourceList region={resources} /> : <Skeleton className="h-32" />}
      </Card>

      {error && <div className="mt-4"><ErrorNote message={error} /></div>}

      <Card className="mt-4">
        <h2 className="font-sans text-lg font-semibold">People I trust</h2>
        <p className="text-sm text-ink-soft">You choose who feels safe. When a conversation suggests you could use support, these people show up with one-tap email, text and call buttons. You send the message yourself. The app never contacts anyone for you.</p>
        <div className="mt-3">
          <ReachOut contacts={contacts} compact />
        </div>
        {contacts.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {contacts.map((k) => (
              <li key={k.id}>
                <ConfirmButton confirmLabel={`Remove ${k.name}`} onConfirm={async () => { await api(`/trusted-contacts/${k.id}`, { method: "DELETE" }); setContacts((x) => x.filter((y) => y.id !== k.id)); }}>Remove {k.name}</ConfirmButton>
              </li>
            ))}
          </ul>
        )}
        {contacts.length < 5 && (
          <form onSubmit={addContact} className="mt-3 grid gap-2 sm:grid-cols-2">
            <div><Label htmlFor="cn">Name</Label><Input id="cn" required maxLength={80} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></div>
            <div><Label htmlFor="cr" hint="(optional)">Who they are</Label><Input id="cr" maxLength={60} value={c.relationship} onChange={(e) => setC({ ...c, relationship: e.target.value })} /></div>
            <div><Label htmlFor="ce">Email</Label><Input id="ce" type="email" maxLength={254} value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></div>
            <div><Label htmlFor="cp" hint="(optional)">Phone</Label><Input id="cp" type="tel" maxLength={30} value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></div>
            <div className="sm:col-span-2"><Button type="submit" variant="secondary" disabled={!c.name.trim() || (!c.email.trim() && !c.phone.trim())}><UserPlus className="size-4" aria-hidden /> Add person</Button></div>
          </form>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="font-sans text-lg font-semibold">My safety plan</h2>
        <p className="text-sm text-ink-soft">A personal plan you write for yourself, ideally with someone you trust or a professional. Fill in only what feels useful.</p>
        {!plan ? <Skeleton className="mt-4 h-40" /> : (
          <div className="mt-4 space-y-4">
            {FIELDS.map(([k, label, hint]) => (
              <div key={k}>
                <Label htmlFor={k}>{label}</Label>
                <p className="mb-1 text-xs text-muted">{hint}</p>
                <Textarea id={k} maxLength={2000} value={plan[k]} onChange={(e) => setPlan({ ...plan, [k]: e.target.value })} />
              </div>
            ))}
            <div className="flex items-center gap-3">
              <Button onClick={save} loading={saving}>Save plan</Button>
              {savedAt && <span role="status" className="text-sm text-muted">Saved at {savedAt}</span>}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
