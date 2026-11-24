import Link from "next/link";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <Brand />
      <main id="main" className="mt-16">
        <h1 className="text-3xl font-semibold">This page isn&apos;t here</h1>
        <p className="mt-2 text-ink-soft">It may have moved, or the link might be wrong.</p>
        <div className="mt-6 flex gap-3">
          <Link href="/app" className="rounded-full bg-teal px-5 py-2.5 font-medium text-white">Go home</Link>
          <Link href="/help" className="rounded-full px-5 py-2.5 font-medium text-rose-ink">Help resources</Link>
        </div>
      </main>
    </div>
  );
}
