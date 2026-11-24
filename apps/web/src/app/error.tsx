"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-ink-soft">Your data is safe. Please try again.</p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="rounded-full bg-teal px-5 py-2.5 font-medium text-white">Try again</button>
        <Link href="/help" className="rounded-full px-5 py-2.5 font-medium text-rose-ink">Help resources</Link>
      </div>
    </div>
  );
}
