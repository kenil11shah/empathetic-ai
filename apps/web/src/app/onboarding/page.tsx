"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand, Disclaimer } from "@/components/brand";
import { Button, Card, ErrorNote, Input, Label, Select, Toggle } from "@/components/ui";
import { api, userTimezone } from "@/lib/client-api";
import { CONSENT_INFO, COUNTRIES, MODES, MODE_INFO, type ConsentType, type Mode } from "@/lib/constants";

const STEPS = ["Before we start", "About you", "How should it support you?", "Someone you trust", "Your privacy choices"];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [adult, setAdult] = useState(false);
  const [ack, setAck] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("IN");
  const [tz, setTz] = useState("UTC");
  const [mode, setMode] = useState<Mode>("just_listen");
  const [consents, setConsents] = useState<Record<ConsentType, boolean>>({ memory: false, emotion_history: true, insights: false, voice_processing: true, research: false });
  const [contact, setContact] = useState({ name: "", email: "", phone: "", relationship: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const zone = userTimezone();
    setTz(zone);
    if (zone.startsWith("America/") && !zone.includes("Toronto") && !zone.includes("Vancouver")) setCountry("US");
    else if (zone === "Europe/London") setCountry("GB");
    else if (zone.startsWith("Australia/")) setCountry("AU");
    else if (zone.includes("Toronto") || zone.includes("Vancouver")) setCountry("CA");
    else if (zone === "Asia/Kolkata" || zone === "Asia/Calcutta") setCountry("IN");
  }, []);

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/onboarding", {
        method: "POST",
        json: {
          adult_confirmed: adult, disclosure_ack: ack, display_name: name || null, country, timezone: tz, default_mode: mode, consents,
          trusted_contact: contact.name.trim()
            ? { name: contact.name.trim(), email: contact.email.trim() || null, phone: contact.phone.trim() || null, relationship: contact.relationship.trim() || null }
            : null,
        },
      });
      router.replace("/app");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-6">
      <Brand />
      <main id="main" className="py-10">
        <p className="text-sm font-medium text-teal">Step {step + 1} of {STEPS.length}</p>
        <h1 className="mt-1 text-3xl font-semibold">{STEPS[step]}</h1>
        <div className="mt-3 h-1.5 rounded-full bg-line" aria-hidden>
          <div className="h-1.5 rounded-full bg-teal transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>

        <Card className="mt-6">
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-ink-soft">
                Empathetic AI is an <strong>AI</strong>, not a person. It can listen, help you reflect and suggest small steps.
                It can make mistakes, including about how you feel, and you can always correct it.
              </p>
              <Disclaimer />
              <label className="flex items-start gap-3 rounded-xl border border-line p-3">
                <input type="checkbox" className="mt-1 size-4 accent-teal" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
                <span>I am 18 or older.</span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-line p-3">
                <input type="checkbox" className="mt-1 size-4 accent-teal" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <span>I understand this is an AI research prototype, not therapy or an emergency service.</span>
              </label>
              {!adult && <p className="text-sm text-muted">This prototype is only for adults. If you&apos;re under 18 and need support, please talk to a trusted adult or a local helpline.</p>}
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name" hint="(optional)">What should we call you?</Label>
                <Input id="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="A first name or nickname" />
              </div>
              <div>
                <Label htmlFor="country">Where are you based?</Label>
                <Select id="country" value={country} onChange={(e) => setCountry(e.target.value)}>
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </Select>
                <p className="mt-1 text-sm text-muted">Used only to show the right help resources.</p>
              </div>
              <p className="text-sm text-muted">Time zone detected: {tz}</p>
            </div>
          )}
          {step === 2 && (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-ink-soft">Choose a default. You can switch any time in a chat.</legend>
              {MODES.map((m) => (
                <label key={m} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${mode === m ? "border-teal bg-teal-soft/50" : "border-line"}`}>
                  <input type="radio" name="mode" className="mt-1 accent-teal" checked={mode === m} onChange={() => setMode(m)} />
                  <span><span className="font-medium">{MODE_INFO[m].label}</span><span className="block text-sm text-ink-soft">{MODE_INFO[m].blurb}</span></span>
                </label>
              ))}
            </fieldset>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-ink-soft">
                When things get really hard, it helps to reach someone quickly. Add a person you trust and feel safe with.
                If a conversation suggests you could use support, the app shows a button to email, text or call them.
              </p>
              <p className="rounded-xl bg-teal-soft px-4 py-3 text-sm text-teal-dark">
                You always send the message yourself. The app never contacts anyone on its own. You can change or remove this person any time in the Safety centre.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="tc-name">Their name</Label>
                  <Input id="tc-name" maxLength={80} value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="e.g. Aarini" />
                </div>
                <div>
                  <Label htmlFor="tc-rel" hint="(optional)">Who they are to you</Label>
                  <Input id="tc-rel" maxLength={60} value={contact.relationship} onChange={(e) => setContact({ ...contact, relationship: e.target.value })} placeholder="sister, friend, mentor" />
                </div>
                <div>
                  <Label htmlFor="tc-email">Email</Label>
                  <Input id="tc-email" type="email" maxLength={254} value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="name@example.com" />
                </div>
                <div>
                  <Label htmlFor="tc-phone" hint="(optional)">Phone</Label>
                  <Input id="tc-phone" type="tel" maxLength={30} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value.replace(/[^+0-9 ()-]/g, "") })} placeholder="+91 98xxx xxxxx" />
                </div>
              </div>
              {contact.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email) && <p className="text-sm text-rose-ink">That email doesn&apos;t look right yet.</p>}
            </div>
          )}
          {step === 4 && (
            <div className="divide-y divide-line">
              {(Object.keys(CONSENT_INFO) as ConsentType[]).filter((c) => c !== "research").map((c) => (
                <Toggle key={c} id={`c-${c}`} label={CONSENT_INFO[c].label} description={CONSENT_INFO[c].detail} checked={consents[c]} onChange={(v) => setConsents({ ...consents, [c]: v })} />
              ))}
              <p className="pt-3 text-sm text-muted">Saying no to any of these never blocks chatting. You can change them later in Settings.</p>
            </div>
          )}
        </Card>

        {error && <div className="mt-4"><ErrorNote message={error} /></div>}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
          <div className="flex gap-2">
            {(step === 1 || step === 2 || step === 3) && <Button variant="secondary" onClick={() => { if (step === 3) setContact({ name: "", email: "", phone: "", relationship: "" }); setStep(step + 1); }}>Skip</Button>}
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={(step === 0 && (!adult || !ack)) || (step === 3 && !!contact.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email))}>Continue</Button>
            ) : (
              <Button onClick={finish} loading={busy}>Finish</Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
