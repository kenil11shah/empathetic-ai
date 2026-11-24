"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckinForm, type Checkin } from "@/components/checkin-form";
import { Badge, Button, Card, ConfirmButton, EmptyState, ErrorNote, PageHeader, Skeleton } from "@/components/ui";
import { api } from "@/lib/client-api";
import { EMOTION_LABEL } from "@/lib/constants";
import { Smile } from "lucide-react";

export default function CheckinsPage() {
  const [items, setItems] = useState<Checkin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await api<{ checkins: Checkin[] }>("/checkins?limit=120")).checkins);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Check-ins" subtitle="Quick self-reports of mood, stress and energy. Skip any day, add as many as you like." actions={!adding && <Button onClick={() => setAdding(true)}>New check-in</Button>} />
      {adding && (
        <Card className="mb-6">
          <h2 className="mb-4 font-sans text-lg font-semibold">How are you right now?</h2>
          <CheckinForm onSaved={(c) => { setAdding(false); setItems((prev) => [c, ...(prev ?? [])]); }} onCancel={() => setAdding(false)} />
        </Card>
      )}
      {error && <ErrorNote message={error} onRetry={load} />}
      {!items ? (
        <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : items.length === 0 && !adding ? (
        <EmptyState icon={<Smile className="size-8" />} title="No check-ins yet" action={<Button onClick={() => setAdding(true)}>Do your first check-in</Button>}>
          Insights need a few check-ins on different days before any patterns are shown. There&apos;s no pressure to do this daily.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id}>
              <Card>
                {editing === c.id ? (
                  <CheckinForm initial={c} onSaved={(n) => { setEditing(null); setItems((prev) => prev!.map((x) => (x.id === n.id ? n : x))); }} onCancel={() => setEditing(null)} />
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted">{c.local_date} · {new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      <p className="mt-1 font-medium">Mood {c.mood}/5 · Stress {c.stress}/10 · Energy {c.energy}/10{c.sleep_hours != null && ` · Sleep ${c.sleep_hours}h`}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.emotions.map((e) => <Badge key={e}>{EMOTION_LABEL[e]}</Badge>)}
                        {c.tags.map((t) => <Badge key={t} tone="grey">#{t}</Badge>)}
                      </div>
                      {c.notes && <p className="mt-2 text-sm text-ink-soft">{c.notes}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(c.id)}>Edit</Button>
                      <ConfirmButton onConfirm={async () => { await api(`/checkins/${c.id}`, { method: "DELETE" }); setItems((prev) => prev!.filter((x) => x.id !== c.id)); }}>Delete</ConfirmButton>
                    </div>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
