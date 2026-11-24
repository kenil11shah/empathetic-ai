"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckSquare, MessageCircle, Smile } from "lucide-react";
import { useMe } from "@/components/app-shell";
import { CheckinForm, type Checkin } from "@/components/checkin-form";
import { Badge, Button, Card, ErrorNote, Skeleton } from "@/components/ui";
import { api, localDateISO } from "@/lib/client-api";
import { MODE_INFO, type Mode } from "@/lib/constants";

type Data = {
  sessions: { id: string; title: string; mode: Mode; updated_at: string }[];
  tasks: { id: string; title: string; status: string; due_date: string | null }[];
  entries: { id: string; title: string; body: string; entry_date: string }[];
  checkins: Checkin[];
  proposals: { id: string }[];
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const { me } = useMe();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkinOpen, setCheckinOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, t, j, c, p] = await Promise.all([
        api<{ sessions: Data["sessions"] }>("/sessions"),
        api<{ tasks: Data["tasks"] }>("/tasks"),
        api<{ entries: Data["entries"] }>("/journal"),
        api<{ checkins: Checkin[] }>("/checkins?limit=5"),
        api<{ proposals: { id: string }[] }>("/proposals"),
      ]);
      setData({ sessions: s.sessions, tasks: t.tasks, entries: j.entries, checkins: c.checkins, proposals: p.proposals });
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = localDateISO();
  const checkedInToday = data?.checkins.some((c) => c.local_date === today);
  const openTasks = data?.tasks.filter((t) => t.status === "todo") ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-3xl font-semibold">{greeting()}{me.profile?.display_name ? `, ${me.profile.display_name}` : ""}.</h1>
      <p className="mt-1 text-ink-soft">What would help right now?</p>

      {error && <div className="mt-4"><ErrorNote message={error} onRetry={load} /></div>}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="bg-teal text-white md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Talk it through</h2>
              <p className="mt-1 text-white/80">Type or record what&apos;s on your mind. Choose listening, thinking or planning.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/app/chat?new=1" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 font-medium text-teal-dark hover:bg-canvas">
                <MessageCircle className="size-4" aria-hidden /> New conversation
              </Link>
              <Link href="/app/chat?private=1" className="inline-flex h-11 items-center rounded-full border border-white/40 px-5 font-medium text-white hover:bg-white/10">
                Private chat
              </Link>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-sans text-lg font-semibold"><Smile className="size-5 text-teal" aria-hidden /> Daily check-in</h2>
            {checkedInToday && <Badge>Done today</Badge>}
          </div>
          {!data ? (
            <Skeleton className="mt-4 h-24" />
          ) : checkinOpen ? (
            <div className="mt-4">
              <CheckinForm compact onSaved={() => { setCheckinOpen(false); void load(); }} onCancel={() => setCheckinOpen(false)} />
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-ink-soft">{checkedInToday ? "You can add another if things change." : "A 20-second note on mood, stress and energy. Optional, always."}</p>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => setCheckinOpen(true)}>{checkedInToday ? "Add another" : "Check in"}</Button>
                <Link href="/app/checkins" className="inline-flex h-10 items-center px-3 text-sm font-medium text-teal">Full check-in</Link>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-sans text-lg font-semibold"><CheckSquare className="size-5 text-teal" aria-hidden /> Tasks</h2>
            {!!data?.proposals.length && <Badge tone="sand">{data.proposals.length} suggestion{data.proposals.length > 1 ? "s" : ""} to review</Badge>}
          </div>
          {!data ? (
            <Skeleton className="mt-4 h-24" />
          ) : openTasks.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">Nothing open. Tasks you approve in chat, or add yourself, appear here.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {openTasks.slice(0, 4).map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm">
                  <span>{t.title}</span>
                  {t.due_date && <span className="text-xs text-muted">{t.due_date}</span>}
                </li>
              ))}
            </ul>
          )}
          <Link href="/app/tasks" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-teal">All tasks <ArrowRight className="size-3.5" aria-hidden /></Link>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 font-sans text-lg font-semibold"><MessageCircle className="size-5 text-teal" aria-hidden /> Continue a conversation</h2>
          {!data ? (
            <Skeleton className="mt-4 h-24" />
          ) : data.sessions.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">Your saved conversations will show up here.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.sessions.slice(0, 3).map((s) => (
                <li key={s.id}>
                  <Link href={`/app/chat?s=${s.id}`} className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm hover:bg-teal-soft/50">
                    <span className="truncate">{s.title}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted">{MODE_INFO[s.mode].label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 font-sans text-lg font-semibold"><BookOpen className="size-5 text-teal" aria-hidden /> Journal</h2>
          {!data ? (
            <Skeleton className="mt-4 h-24" />
          ) : data.entries.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">No entries yet. Write or dictate whenever you like.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.entries.slice(0, 2).map((e) => (
                <li key={e.id} className="rounded-xl bg-canvas px-3 py-2 text-sm">
                  <span className="font-medium">{e.title || "Untitled"}</span>
                  <span className="ml-2 text-xs text-muted">{e.entry_date}</span>
                  <p className="line-clamp-2 text-ink-soft">{e.body}</p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/app/journal" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-teal">Open journal <ArrowRight className="size-3.5" aria-hidden /></Link>
        </Card>
      </div>
    </div>
  );
}
