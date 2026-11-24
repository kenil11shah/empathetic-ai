import Link from "next/link";

export function Mark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" fill="#187B70" />
      <path d="M9.5 17.5c2.2 3.4 4.4 4.9 6.5 4.9s4.3-1.5 6.5-4.9" stroke="#F5F7F4" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="12.5" r="1.6" fill="#F5F7F4" />
      <circle cx="20" cy="12.5" r="1.6" fill="#F5F7F4" />
    </svg>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
      <Mark />
      <span>Empathetic AI</span>
    </Link>
  );
}

export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-ink-soft ${className}`}>
      Empathetic AI is an AI research prototype for everyday well-being. It is not a therapist, does not diagnose or treat
      any condition, and cannot contact anyone or respond to emergencies. If you are in danger, contact your local
      emergency number. <Link href="/help" className="font-medium text-teal underline underline-offset-2">Find help now</Link>.
    </p>
  );
}
