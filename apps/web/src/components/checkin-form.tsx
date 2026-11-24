"use client";
import { useState } from "react";
import { Button, ErrorNote, Input, Label, Textarea, cx } from "@/components/ui";
import { api, localDateISO, userTimezone } from "@/lib/client-api";
import { EMOTIONS, EMOTION_LABEL, type Emotion } from "@/lib/constants";

export type Checkin = {
  id: string;
  mood: number;
  stress: number;
  energy: number;
  sleep_hours: number | null;
  emotions: Emotion[];
  tags: string[];
  notes: string | null;
  local_date: string;
  created_at: string;
};

const MOODS = ["Very low", "Low", "Okay", "Good", "Very good"];

function Scale({ id, label, value, onChange, min, max, lowLabel, highLabel }: { id: string; label: string; value: number; onChange: (v: number) => void; min: number; max: number; lowLabel: string; highLabel: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-sm font-semibold text-teal-dark">{value} / {max}</span>
      </div>
      <input id={id} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-teal" aria-valuetext={`${value} out of ${max}`} />
      <div className="flex justify-between text-xs text-muted"><span>{lowLabel}</span><span>{highLabel}</span></div>
    </div>
  );
}

export function CheckinForm({ initial, onSaved, onCancel, compact }: { initial?: Checkin; onSaved: (c: Checkin) => void; onCancel?: () => void; compact?: boolean }) {
  const [mood, setMood] = useState(initial?.mood ?? 3);
  const [stress, setStress] = useState(initial?.stress ?? 5);
  const [energy, setEnergy] = useState(initial?.energy ?? 5);
  const [sleep, setSleep] = useState(initial?.sleep_hours?.toString() ?? "");
  const [emotions, setEmotions] = useState<Emotion[]>(initial?.emotions ?? []);
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = {
      mood,
      stress,
      energy,
      sleep_hours: sleep === "" ? null : Number(sleep),
      emotions,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12),
      notes: notes.trim() || null,
      local_date: initial?.local_date ?? localDateISO(),
      timezone: userTimezone(),
    };
    try {
      const res = initial
        ? await api<{ checkin: Checkin }>(`/checkins/${initial.id}`, { method: "PATCH", json: body })
        : await api<{ checkin: Checkin }>("/checkins", { method: "POST", json: body });
      onSaved(res.checkin);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">How is your mood?</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {MOODS.map((m, i) => (
            <button key={m} type="button" onClick={() => setMood(i + 1)} aria-pressed={mood === i + 1} className={cx("rounded-xl border px-1 py-2 text-xs font-medium transition-colors", mood === i + 1 ? "border-teal bg-teal text-white" : "border-line bg-surface text-ink-soft hover:border-teal/50")}>
              <span className="block text-base">{i + 1}</span>
              {m}
            </button>
          ))}
        </div>
      </fieldset>
      <Scale id="stress" label="Stress" value={stress} onChange={setStress} min={1} max={10} lowLabel="Very little" highLabel="A lot" />
      <Scale id="energy" label="Energy" value={energy} onChange={setEnergy} min={1} max={10} lowLabel="Drained" highLabel="Energised" />
      {!compact && (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Any of these feelings? <span className="font-normal text-muted">(optional)</span></legend>
            <div className="flex flex-wrap gap-2">
              {EMOTIONS.map((e) => {
                const on = emotions.includes(e);
                return (
                  <button key={e} type="button" aria-pressed={on} onClick={() => setEmotions(on ? emotions.filter((x) => x !== e) : [...emotions, e])} className={cx("rounded-full border px-3 py-1 text-sm", on ? "border-teal bg-teal-soft text-teal-dark" : "border-line text-ink-soft")}>
                    {EMOTION_LABEL[e]}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="sleep" hint="(optional)">Hours of sleep</Label>
              <Input id="sleep" type="number" inputMode="decimal" min={0} max={24} step={0.5} value={sleep} onChange={(e) => setSleep(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="tags" hint="(comma separated)">Tags</Label>
              <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="work, exams, family" />
            </div>
          </div>
          <div>
            <Label htmlFor="notes" hint="(optional)">Notes</Label>
            <Textarea id="notes" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </>
      )}
      {error && <ErrorNote message={error} onRetry={save} />}
      <div className="flex gap-2">
        <Button onClick={save} loading={busy}>{initial ? "Save changes" : "Save check-in"}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  );
}
