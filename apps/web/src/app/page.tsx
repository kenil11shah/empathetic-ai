import Link from "next/link";
import { ArrowRight, BookHeart, CheckCircle2, HeartHandshake, Lock, Mic, ShieldCheck, Sparkles } from "lucide-react";
import { Brand, Disclaimer } from "@/components/brand";

const features = [
  { icon: HeartHandshake, title: "Feel heard first", text: "Pick how you want support: just listening, thinking it through, problem solving or calming down. Advice only when you ask for it." },
  { icon: Sparkles, title: "Emotion-aware, and correctable", text: "It offers a tentative read of how you might be feeling, says when it isn't sure, and your correction always wins." },
  { icon: CheckCircle2, title: "From overwhelm to small steps", text: "When you want a plan, it proposes a few small tasks. Nothing is saved until you review and approve it." },
  { icon: BookHeart, title: "Reflect over time", text: "Daily check-ins, a private journal and trends built only from what you report, with honest gaps and no scores." },
  { icon: ShieldCheck, title: "Independent safety layer", text: "A separate safety policy screens every message and reply, and help resources are always one tap away." },
  { icon: Lock, title: "You control your data", text: "Private chats that are never stored, memory that's off until you opt in, and one-click export or deletion." },
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Brand />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/help" className="rounded-full px-3 py-2 font-medium text-rose-ink hover:bg-rose-soft">Get help now</Link>
          <Link href="/login" className="rounded-full bg-ink px-4 py-2 font-medium text-white hover:bg-ink/90">Sign in</Link>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 md:grid-cols-[1.1fr_0.9fr] md:pt-16">
          <div className="rise">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-teal-soft px-3 py-1 text-sm font-medium text-teal-dark">
              <Mic className="size-4" aria-hidden /> Talk or type, at your own pace
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-ink md:text-6xl">
              A calm place to say what&apos;s on your mind.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft">
              Empathetic AI helps you express what you&apos;re experiencing, feel heard, notice patterns, and turn everyday
              challenges into steps you can actually take, with clear limits and you in control.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="inline-flex h-12 items-center gap-2 rounded-full bg-teal px-6 font-medium text-white shadow-sm hover:bg-teal-dark">
                Start a conversation <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/login?guest=1" className="inline-flex h-12 items-center rounded-full border border-line bg-surface px-6 font-medium text-ink hover:border-teal/50">
                Try it as a guest
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted">For adults 18+. Free research prototype.</p>
          </div>

          <div className="rise rounded-[2rem] border border-line bg-surface p-5 shadow-[0_20px_60px_-30px_rgba(23,53,47,0.35)]" aria-label="Example conversation">
            <div className="mb-4 flex items-center justify-between text-xs text-muted">
              <span className="rounded-full bg-teal-soft px-2.5 py-1 font-medium text-teal-dark">Help Me Think</span>
              <span>Example</span>
            </div>
            <div className="space-y-3 text-sm">
              <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-white">I have three deadlines this week and I can&apos;t even start.</p>
              <p className="text-xs text-muted">This might be <span className="font-medium text-ink">worry or anxiety</span> · <span className="underline">change</span></p>
              <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-canvas px-4 py-2.5 text-ink">That sounds like a lot landing at once. Which of the three feels heaviest right now, and what would &quot;started&quot; look like for it?</p>
              <div className="rounded-2xl border border-teal/30 bg-teal-soft/50 p-3">
                <p className="font-medium text-teal-dark">Suggested plan · needs your approval</p>
                <ul className="mt-2 space-y-1 text-ink-soft">
                  <li>☐ List all three deadlines with dates (5 min)</li>
                  <li>☐ Open the hardest one and write one rough line</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-surface/70">
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-14 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title}>
                <f.icon className="mb-3 size-6 text-teal" aria-hidden />
                <h2 className="font-sans text-lg font-semibold">{f.title}</h2>
                <p className="mt-1 text-ink-soft">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-14">
          <h2 className="text-2xl font-semibold">What it is, and what it isn&apos;t</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-teal-soft/60 p-5">
              <h3 className="font-sans font-semibold text-teal-dark">It is</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
                <li>A supportive space to vent, reflect and plan</li>
                <li>Transparent about uncertainty</li>
                <li>Clear that it&apos;s an AI</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-sand p-5">
              <h3 className="font-sans font-semibold text-sand-dark">It isn&apos;t</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
                <li>Therapy, diagnosis or medical advice</li>
                <li>An emergency or crisis-monitoring service</li>
                <li>A replacement for people who care about you</li>
              </ul>
            </div>
          </div>
          <Disclaimer className="mt-6" />
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted">
          <span>© {new Date().getFullYear()} Empathetic AI · research prototype</span>
          <nav className="flex gap-4">
            <Link href="/privacy" className="hover:text-ink">Privacy & limits</Link>
            <Link href="/help" className="hover:text-ink">Help resources</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
