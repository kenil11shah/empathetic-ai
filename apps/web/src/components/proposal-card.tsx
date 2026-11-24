"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Plus, Trash2 } from "lucide-react";
import { Badge, Button, ErrorNote, Input, Textarea } from "@/components/ui";
import { api } from "@/lib/client-api";

export type Proposal = {
  id: string;
  type: "task_plan" | "journal_entry" | "memory";
  preview: string;
  reason: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired" | "cancelled";
  expires_at: string;
  result?: Record<string, unknown> | null;
};

type Task = { title: string; due_date?: string | null };

/**
 * Approval card: shows exactly what will happen, lets the user edit the payload, and only
 * then calls the approval endpoint. Nothing changes in the user's data before approval.
 */
export function ProposalCard({ proposal, onChange }: { proposal: Proposal; onChange: (p: Proposal) => void }) {
  const [editing, setEditing] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(((proposal.payload.tasks as Task[]) ?? []).map((t) => ({ ...t })));
  const [title, setTitle] = useState(String(proposal.payload.title ?? ""));
  const [body, setBody] = useState(String(proposal.payload.body ?? ""));
  const [summary, setSummary] = useState(String(proposal.payload.summary ?? ""));
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const expired = proposal.status === "pending" && new Date(proposal.expires_at).getTime() < now;

  const payload = () => {
    if (proposal.type === "task_plan") return { tasks: tasks.filter((t) => t.title.trim()).map((t) => ({ title: t.title.trim(), due_date: t.due_date || null })) };
    if (proposal.type === "journal_entry") return { title, body, tags: (proposal.payload.tags as string[]) ?? [] };
    return { summary, category: proposal.payload.category ?? "other" };
  };

  const approve = async () => {
    setBusy("approve");
    setError(null);
    try {
      const res = await api<{ result: Record<string, unknown> }>(`/proposals/${proposal.id}/approve`, { method: "POST", json: { payload: payload() } });
      onChange({ ...proposal, status: "approved", result: res.result, payload: payload() });
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "expired") onChange({ ...proposal, status: "expired" });
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    setBusy("reject");
    setError(null);
    try {
      await api(`/proposals/${proposal.id}/reject`, { method: "POST" });
      onChange({ ...proposal, status: "rejected" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const statusBadge =
    proposal.status === "approved" ? <Badge><Check className="size-3" aria-hidden /> Approved</Badge>
    : proposal.status === "rejected" ? <Badge tone="grey">Dismissed</Badge>
    : proposal.status === "expired" || expired ? <Badge tone="grey">Expired</Badge>
    : <Badge tone="sand">Needs your approval</Badge>;

  const pending = proposal.status === "pending" && !expired;

  return (
    <div className="rise mt-2 max-w-xl rounded-2xl border border-teal/30 bg-teal-soft/40 p-4" aria-label="Suggested action">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-teal-dark">{proposal.preview}</p>
        {statusBadge}
      </div>
      {proposal.reason && <p className="mt-1 text-sm text-ink-soft">{proposal.reason}</p>}

      <div className="mt-3">
        {proposal.type === "task_plan" &&
          (editing && pending ? (
            <ul className="space-y-2">
              {tasks.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <Input aria-label={`Task ${i + 1}`} value={t.title} maxLength={200} onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <Input aria-label={`Due date for task ${i + 1}`} type="date" className="w-40" value={t.due_date ?? ""} onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, due_date: e.target.value || null } : x)))} />
                  <Button variant="ghost" size="sm" aria-label={`Remove task ${i + 1}`} onClick={() => setTasks(tasks.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                </li>
              ))}
              {tasks.length < 8 && (
                <Button variant="ghost" size="sm" onClick={() => setTasks([...tasks, { title: "", due_date: null }])}><Plus className="size-4" aria-hidden /> Add task</Button>
              )}
            </ul>
          ) : (
            <ul className="space-y-1 text-sm">
              {tasks.map((t, i) => (
                <li key={i} className="flex items-center gap-2"><span className="inline-block size-3.5 rounded border border-teal/60" aria-hidden />{t.title}{t.due_date && <span className="text-xs text-muted">· {t.due_date}</span>}</li>
              ))}
            </ul>
          ))}
        {proposal.type === "journal_entry" &&
          (editing && pending ? (
            <div className="space-y-2">
              <Input aria-label="Journal title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea aria-label="Journal text" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-32" />
            </div>
          ) : (
            <div className="rounded-xl bg-surface p-3 text-sm">
              <p className="font-medium">{title || "Untitled"}</p>
              <p className="mt-1 whitespace-pre-wrap text-ink-soft">{body}</p>
              <p className="mt-2 text-xs text-muted">AI-drafted from your words. Saved only if you approve.</p>
            </div>
          ))}
        {proposal.type === "memory" &&
          (editing && pending ? (
            <Input aria-label="Memory" value={summary} maxLength={400} onChange={(e) => setSummary(e.target.value)} />
          ) : (
            <p className="rounded-xl bg-surface p-3 text-sm">&ldquo;{summary}&rdquo;</p>
          ))}
      </div>

      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      {pending && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={approve} loading={busy === "approve"} disabled={proposal.type === "task_plan" && !tasks.some((t) => t.title.trim())}>Approve</Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(!editing)}>{editing ? "Done editing" : "Edit"}</Button>
          <Button size="sm" variant="ghost" onClick={reject} loading={busy === "reject"}>No thanks</Button>
        </div>
      )}
      {proposal.status === "approved" && (
        <p className="mt-3 text-sm">
          {proposal.type === "task_plan" && <Link className="font-medium text-teal underline" href="/app/tasks">View your tasks</Link>}
          {proposal.type === "journal_entry" && <Link className="font-medium text-teal underline" href="/app/journal">Open journal</Link>}
          {proposal.type === "memory" && <Link className="font-medium text-teal underline" href="/app/settings#memory">Manage memories</Link>}
        </p>
      )}
      {(expired || proposal.status === "expired") && <p className="mt-2 text-xs text-muted">Suggestions expire after 30 minutes. Ask again for a fresh one.</p>}
    </div>
  );
}
