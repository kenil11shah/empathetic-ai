"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { ProposalCard, type Proposal } from "@/components/proposal-card";
import { Badge, Button, Card, ConfirmButton, EmptyState, ErrorNote, Input, PageHeader, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/client-api";

type Task = { id: string; title: string; notes: string | null; due_date: string | null; status: "todo" | "done"; source_session_id: string | null; source_proposal_id: string | null; completed_at: string | null };

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"todo" | "done" | "all">("todo");
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [t, p] = await Promise.all([api<{ tasks: Task[] }>("/tasks"), api<{ proposals: Proposal[] }>("/proposals")]);
      setTasks(t.tasks);
      setProposals(p.proposals.filter((x) => x.type === "task_plan"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ task: Task }>("/tasks", { method: "POST", json: { title, due_date: due || null } });
      setTasks((prev) => [r.task, ...(prev ?? [])]);
      setTitle("");
      setDue("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const update = async (t: Task, patch: Partial<Task>) => {
    const prev = tasks;
    setTasks((ts) => ts!.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
    try {
      const r = await api<{ task: Task }>(`/tasks/${t.id}`, { method: "PATCH", json: patch });
      setTasks((ts) => ts!.map((x) => (x.id === t.id ? r.task : x)));
    } catch (err) {
      setTasks(prev); // roll back the optimistic update
      setError((err as Error).message);
    }
  };

  const shown = (tasks ?? []).filter((t) => filter === "all" || t.status === filter);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Tasks" subtitle="Small, doable steps. Missed one? That's fine, it just stays here until you're ready." />
      {proposals.length > 0 && (
        <section className="mb-6" aria-labelledby="pending">
          <h2 id="pending" className="mb-2 font-sans text-lg font-semibold">Suggestions waiting for you</h2>
          {proposals.map((p) => <ProposalCard key={p.id} proposal={p} onChange={(n) => { setProposals((ps) => ps.map((x) => (x.id === n.id ? n : x))); if (n.status === "approved") void load(); }} />)}
        </section>
      )}
      <Card className="mb-6">
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <label htmlFor="new-task" className="sr-only">New task</label>
          <Input id="new-task" placeholder="Add a task…" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className="min-w-48 flex-1" />
          <label htmlFor="new-due" className="sr-only">Due date (optional)</label>
          <Input id="new-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-40" />
          <Button type="submit" loading={busy} disabled={!title.trim()}>Add</Button>
        </form>
      </Card>
      <div role="tablist" className="mb-3 flex gap-1">
        {(["todo", "done", "all"] as const).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={cx("rounded-full px-3 py-1.5 text-sm font-medium", filter === f ? "bg-ink text-white" : "text-ink-soft hover:bg-surface")}>
            {f === "todo" ? "To do" : f === "done" ? "Done" : "All"}
          </button>
        ))}
      </div>
      {error && <div className="mb-3"><ErrorNote message={error} onRetry={load} /></div>}
      {!tasks ? (
        <Skeleton className="h-32" />
      ) : shown.length === 0 ? (
        <EmptyState icon={<CheckSquare className="size-8" />} title={filter === "done" ? "Nothing completed yet" : "No tasks here"}>
          Add one above, or ask for a small plan in <Link className="text-teal underline" href="/app/chat?new=1">a conversation</Link>.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {shown.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
              <input type="checkbox" className="size-5 accent-teal" checked={t.status === "done"} onChange={(e) => update(t, { status: e.target.checked ? "done" : "todo" })} aria-label={`Mark "${t.title}" as ${t.status === "done" ? "not done" : "done"}`} />
              <div className="min-w-0 flex-1">
                {editing === t.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void update(t, { title: String(f.get("title")), due_date: (f.get("due") as string) || null }); setEditing(null); }} className="flex flex-wrap gap-2">
                    <Input name="title" defaultValue={t.title} aria-label="Task title" className="min-w-40 flex-1" />
                    <Input name="due" type="date" defaultValue={t.due_date ?? ""} aria-label="Due date" className="w-40" />
                    <Button size="sm" type="submit">Save</Button>
                  </form>
                ) : (
                  <>
                    <p className={cx("truncate", t.status === "done" && "text-muted line-through")}>{t.title}</p>
                    <div className="flex gap-2 text-xs text-muted">
                      {t.due_date && <span>Due {t.due_date}</span>}
                      {t.source_proposal_id && <Badge tone="grey">from a chat plan</Badge>}
                    </div>
                  </>
                )}
              </div>
              {editing !== t.id && <Button variant="ghost" size="sm" onClick={() => setEditing(t.id)}>Edit</Button>}
              <ConfirmButton onConfirm={async () => { await api(`/tasks/${t.id}`, { method: "DELETE" }); setTasks((ts) => ts!.filter((x) => x.id !== t.id)); }}>Delete</ConfirmButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
