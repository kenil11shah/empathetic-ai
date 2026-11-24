"use client";
import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, X } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "soft";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  const v = {
    primary: "bg-teal text-white hover:bg-teal-dark shadow-sm",
    secondary: "bg-surface text-ink border border-line hover:border-teal/50 hover:bg-teal-soft/40",
    ghost: "text-ink-soft hover:bg-teal-soft/60 hover:text-ink",
    danger: "bg-rose-ink text-white hover:bg-rose-ink/90",
    soft: "bg-teal-soft text-teal-dark hover:bg-teal-soft/70",
  }[variant];
  const s = { sm: "h-8 px-3 text-sm gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-base gap-2" }[size];
  return (
    <button
      ref={ref}
      className={cx("inline-flex items-center justify-center rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50", v, s, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function Card({ className, children, as: As = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" }) {
  return <As className={cx("rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(23,53,47,0.04)]", className)}>{children}</As>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Label({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
      {children}
      {hint && <span className="ml-1 font-normal text-muted">{hint}</span>}
    </label>
  );
}

const field = "w-full rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-muted/80 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cx(field, "h-10", className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cx(field, "min-h-24", className)} {...p} />;
});
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(field, "h-10 pr-8", className)} {...p}>
      {children}
    </select>
  );
}

export function Badge({ children, tone = "teal", className }: { children: ReactNode; tone?: "teal" | "sand" | "rose" | "grey"; className?: string }) {
  const t = { teal: "bg-teal-soft text-teal-dark", sand: "bg-sand text-sand-dark", rose: "bg-rose-soft text-rose-ink", grey: "bg-canvas text-ink-soft border border-line" }[tone];
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", t, className)}>{children}</span>;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-ink-soft">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-line/60", className)} aria-hidden />;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-teal">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm text-ink-soft">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-ink/20 bg-rose-soft px-4 py-3 text-sm text-rose-ink">
      <span>{message}</span>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={cx("m-auto w-[calc(100%-2rem)] rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink shadow-xl", wide ? "max-w-2xl" : "max-w-lg")}
      aria-labelledby="modal-title"
    >
      {open && (
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id="modal-title" className="text-xl font-semibold">
              {title}
            </h2>
            <button onClick={onClose} className="rounded-full p-1 text-ink-soft hover:bg-teal-soft" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** Two-step destructive confirmation. */
export function ConfirmButton({ onConfirm, children, confirmLabel = "Yes, delete", size = "sm", className }: { onConfirm: () => Promise<void> | void; children: ReactNode; confirmLabel?: string; size?: "sm" | "md"; className?: string }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!armed)
    return (
      <Button variant="ghost" size={size} onClick={() => setArmed(true)} className={className}>
        {children}
      </Button>
    );
  return (
    <span className="inline-flex items-center gap-1">
      <Button
        variant="danger"
        size={size}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setArmed(false);
          }
        }}
      >
        {confirmLabel}
      </Button>
      <Button variant="ghost" size={size} onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </span>
  );
}

export function Toggle({ checked, onChange, label, description, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean; id: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <label htmlFor={id} className="font-medium text-ink">
          {label}
        </label>
        {description && <p className="text-sm text-ink-soft">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx("relative mt-1 block h-6 w-11 shrink-0 rounded-full p-0 transition-colors disabled:opacity-50", checked ? "bg-teal" : "bg-line")}
      >
        <span aria-hidden className={cx("absolute left-0.5 top-0.5 block size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0")} />
      </button>
    </div>
  );
}

/** Polite live region announcer for screen readers. */
export function LiveRegion({ message }: { message: string }) {
  return (
    <div aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}
