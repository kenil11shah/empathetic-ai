"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Brand, Disclaimer } from "@/components/brand";
import { Button, Card, ErrorNote, Input, Label } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") && params.get("next")!.startsWith("/") ? params.get("next")! : "/app";
  const [tab, setTab] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(params.get("error") ? "That link didn't work or has expired. Please try again." : null);
  const [info, setInfo] = useState<string | null>(null);
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

  const guest = async () => {
    setBusy("guest");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInAnonymously();
    setBusy(null);
    if (error) setError("Guest access isn't enabled yet. Please create an account instead.");
    else router.replace("/onboarding");
  };

  useEffect(() => {
    if (params.get("guest") === "1" && configured) void guest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(tab);
    const supabase = createClient();
    const origin = window.location.origin;
    try {
      if (tab === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
      } else if (tab === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
        });
        if (error) throw error;
        if (data.session) router.replace("/onboarding");
        else setInfo("Check your email to confirm your account, then come back and sign in.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/app/settings` });
        if (error) throw error;
        setInfo("If an account exists for that email, a reset link is on its way. After opening it, set a new password in Settings.");
      }
    } catch (err) {
      const msg = (err as Error).message || "Something went wrong.";
      setError(/invalid login/i.test(msg) ? "That email and password don't match." : msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-6">
      <Brand />
      <main id="main" className="my-auto py-10">
        <h1 className="text-3xl font-semibold">{tab === "signup" ? "Create your space" : tab === "reset" ? "Reset password" : "Welcome back"}</h1>
        <p className="mt-1 text-ink-soft">For adults 18 and over.</p>
        {!configured && (
          <div className="mt-4">
            <ErrorNote message="The database isn't connected yet. Add the Supabase environment variables (see the handbook)." />
          </div>
        )}
        <Card className="mt-6">
          {tab !== "reset" && (
            <div role="tablist" className="mb-5 grid grid-cols-2 rounded-full bg-canvas p-1 text-sm">
              {(["signin", "signup"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full py-2 font-medium ${tab === t ? "bg-surface text-ink shadow-sm" : "text-ink-soft"}`}>
                  {t === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {tab !== "reset" && (
              <div>
                <Label htmlFor="password" hint={tab === "signup" ? "(at least 8 characters)" : undefined}>Password</Label>
                <Input id="password" type="password" autoComplete={tab === "signup" ? "new-password" : "current-password"} minLength={tab === "signup" ? 8 : undefined} required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            {error && <ErrorNote message={error} />}
            {info && <p role="status" className="rounded-xl bg-teal-soft px-4 py-3 text-sm text-teal-dark">{info}</p>}
            <Button type="submit" className="w-full" loading={busy === tab} disabled={!configured}>
              {tab === "signin" ? "Sign in" : tab === "signup" ? "Create account" : "Send reset link"}
            </Button>
          </form>
          <div className="mt-4 flex justify-between text-sm">
            {tab === "reset" ? (
              <button className="text-teal underline-offset-2 hover:underline" onClick={() => setTab("signin")}>Back to sign in</button>
            ) : (
              <button className="text-ink-soft underline-offset-2 hover:underline" onClick={() => setTab("reset")}>Forgot password?</button>
            )}
          </div>
          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <Button variant="secondary" className="w-full" onClick={guest} loading={busy === "guest"} disabled={!configured}>
            Continue as guest
          </Button>
          <p className="mt-2 text-center text-xs text-muted">Guest accounts are deleted after 30 days. Add an email in Settings to keep yours.</p>
        </Card>
        <Disclaimer className="mt-6" />
        <p className="mt-4 text-center text-sm"><Link href="/help" className="font-medium text-rose-ink">Need help right now?</Link></p>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
