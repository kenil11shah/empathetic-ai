"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BookOpen, CheckSquare, HeartPulse, Home, LifeBuoy, Menu, MessageCircle, Settings, Smile, Sparkles, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { Spinner, cx } from "@/components/ui";
import { api } from "@/lib/client-api";
import type { ConsentType, Mode } from "@/lib/constants";

export type Me = {
  user: { id: string; email: string | null; is_guest: boolean };
  profile: { display_name: string | null; country: string; timezone: string; default_mode: Mode; voice_output: boolean; onboarded_at: string | null } | null;
  consents: Record<ConsentType, boolean>;
  demo: { llm: boolean; transcription: boolean; transformer: boolean; accountDeletion: boolean };
};

const MeContext = createContext<{ me: Me; refresh: () => Promise<void> } | null>(null);
export const useMe = () => {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe outside provider");
  return ctx;
};

const NAV = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/chat", label: "Chat", icon: MessageCircle },
  { href: "/app/journal", label: "Journal", icon: BookOpen },
  { href: "/app/checkins", label: "Check-ins", icon: Smile },
  { href: "/app/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/app/insights", label: "Insights", icon: BarChart3 },
  { href: "/app/wellness", label: "Wellness", icon: HeartPulse },
  { href: "/app/safety", label: "Safety centre", icon: LifeBuoy },
  { href: "/app/settings", label: "Settings", icon: Settings },
];
const MOBILE = ["/app", "/app/chat", "/app/journal", "/app/tasks"];

export function AppShell({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const data = await api<Me>("/me");
      if (!data.profile?.onboarded_at) {
        router.replace("/onboarding");
        return;
      }
      setMe(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (error)
    return (
      <div className="mx-auto max-w-md p-8">
        <p role="alert" className="text-rose-ink">{error}</p>
        <Link href="/help" className="mt-4 inline-block text-teal underline">Help resources</Link>
      </div>
    );
  if (!me)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner label="Opening your space" />
      </div>
    );

  const active = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));
  const demo = me.demo.llm;

  return (
    <MeContext.Provider value={{ me, refresh }}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface/70 px-4 py-5 lg:flex">
          <Brand href="/app" />
          <nav className="mt-8 flex-1 space-y-1" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={cx("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium", active(n.href) ? "bg-teal-soft text-teal-dark" : "text-ink-soft hover:bg-canvas hover:text-ink")}>
                <n.icon className="size-4" aria-hidden />
                {n.label}
              </Link>
            ))}
          </nav>
          {demo && (
            <p className="mb-3 rounded-xl bg-sand px-3 py-2 text-xs text-sand-dark">
              <Sparkles className="mr-1 inline size-3" aria-hidden /> Demo mode: AI replies are templated until an LLM key is added.
            </p>
          )}
          <Link href="/app/safety" className="flex items-center justify-center gap-2 rounded-xl bg-rose-soft px-3 py-2.5 text-sm font-semibold text-rose-ink hover:bg-rose-soft/70">
            <LifeBuoy className="size-4" aria-hidden /> Get help now
          </Link>
        </aside>

        <div className="flex min-h-dvh flex-col pb-20 lg:pb-0">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur lg:hidden">
            <Brand href="/app" />
            <Link href="/app/safety" className="rounded-full bg-rose-soft px-3 py-1.5 text-sm font-semibold text-rose-ink">Get help</Link>
          </header>
          {demo && <p className="bg-sand px-4 py-1.5 text-center text-xs text-sand-dark lg:hidden">Demo mode: AI replies are templated.</p>}
          <main id="main" className="flex-1">{children}</main>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Mobile">
          {NAV.filter((n) => MOBILE.includes(n.href)).map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active(n.href) ? "text-teal" : "text-ink-soft")}>
              <n.icon className="size-5" aria-hidden />
              {n.label}
            </Link>
          ))}
          <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink-soft" aria-expanded={moreOpen}>
            <Menu className="size-5" aria-hidden /> More
          </button>
        </nav>

        {moreOpen && (
          <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden" onClick={() => setMoreOpen(false)}>
            <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="More pages">
              <div className="mb-2 flex justify-between">
                <span className="font-semibold">More</span>
                <button onClick={() => setMoreOpen(false)} aria-label="Close"><X className="size-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {NAV.filter((n) => !MOBILE.includes(n.href)).map((n) => (
                  <Link key={n.href} href={n.href} onClick={() => setMoreOpen(false)} className="flex items-center gap-2 rounded-xl border border-line px-3 py-3 text-sm font-medium">
                    <n.icon className="size-4 text-teal" aria-hidden /> {n.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </MeContext.Provider>
  );
}
