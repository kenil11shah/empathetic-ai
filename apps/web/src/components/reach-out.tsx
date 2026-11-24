import { Mail, MessageSquare, Phone } from "lucide-react";

export type TrustedContact = { id: string; name: string; email: string | null; phone: string | null; relationship: string | null };

const MESSAGE = "I'm having a really hard time right now and could use your support. Could you call me or come over when you can?";

function mailto(c: TrustedContact) {
  return `mailto:${encodeURIComponent(c.email ?? "")}?subject=${encodeURIComponent("Could you check in on me?")}&body=${encodeURIComponent(`Hi ${c.name},\n\n${MESSAGE}`)}`;
}
function sms(c: TrustedContact) {
  return `sms:${(c.phone ?? "").replace(/[^+0-9]/g, "")}?&body=${encodeURIComponent(`Hi ${c.name}, ${MESSAGE}`)}`;
}

/**
 * One-tap ways to reach the people the user chose. Each link opens the user's own email,
 * messaging or phone app with a short draft they can edit. Nothing is sent automatically.
 */
export function ReachOut({ contacts, compact }: { contacts: TrustedContact[]; compact?: boolean }) {
  if (!contacts.length) return null;
  return (
    <div className="space-y-2">
      {!compact && <p className="text-sm font-medium text-ink">Reach someone you trust</p>}
      {contacts.map((c) => (
        <div key={c.id} className="rounded-xl border border-line bg-surface p-3">
          <p className="text-sm">
            <span className="font-semibold">{c.name}</span>
            {c.relationship && <span className="text-muted"> · {c.relationship}</span>}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {c.email && (
              <a href={mailto(c)} className="inline-flex items-center gap-1.5 rounded-full bg-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-dark">
                <Mail className="size-3.5" aria-hidden /> Email {c.name}
              </a>
            )}
            {c.phone && (
              <a href={sms(c)} className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft px-3 py-1.5 text-sm font-medium text-teal-dark">
                <MessageSquare className="size-3.5" aria-hidden /> Text
              </a>
            )}
            {c.phone && (
              <a href={`tel:${c.phone.replace(/[^+0-9]/g, "")}`} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-teal/50">
                <Phone className="size-3.5" aria-hidden /> Call
              </a>
            )}
          </div>
          {(c.email || c.phone) && <p className="mt-1.5 text-xs text-muted">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>}
        </div>
      ))}
      <p className="text-xs text-muted">Opens your own email or messaging app with a short draft you can edit. The app never sends anything for you.</p>
    </div>
  );
}
