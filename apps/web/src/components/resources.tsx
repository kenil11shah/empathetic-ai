import { ExternalLink, MessageSquare, Phone } from "lucide-react";
import type { RegionResources } from "@/lib/safety/resources";

export function ResourceList({ region, compact }: { region: RegionResources; compact?: boolean }) {
  return (
    <div className="space-y-3">
      {region.emergency.number ? (
        <a
          href={`tel:${region.emergency.number}`}
          className="flex items-center justify-between rounded-xl bg-rose-ink px-4 py-3 font-medium text-white hover:bg-rose-ink/90"
        >
          <span>If you are in immediate danger: {region.emergency.label}</span>
          <Phone className="size-4" aria-hidden />
        </a>
      ) : (
        <p className="rounded-xl bg-rose-soft px-4 py-3 text-sm font-medium text-rose-ink">
          If you are in immediate danger, call your local emergency number.
        </p>
      )}
      {region.resources.map((r) => (
        <div key={r.name} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-sans text-base font-semibold">{r.name}</h3>
            <span className="text-xs text-muted">{r.hours}</span>
          </div>
          {!compact && <p className="mt-1 text-sm text-ink-soft">{r.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {r.phone && (
              <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1.5 rounded-full bg-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-dark">
                <Phone className="size-3.5" aria-hidden /> Call {r.phoneDisplay}
              </a>
            )}
            {r.sms && (
              <a href={`sms:${r.sms}`} className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft px-3 py-1.5 text-sm font-medium text-teal-dark">
                <MessageSquare className="size-3.5" aria-hidden /> {r.smsDisplay}
              </a>
            )}
            {r.url && (
              <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-teal/50">
                Website <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted">
        Resources checked {region.verified_at}. Numbers can change, so check the service&apos;s own site if a call doesn&apos;t connect. This app never contacts anyone on your behalf.
      </p>
    </div>
  );
}
