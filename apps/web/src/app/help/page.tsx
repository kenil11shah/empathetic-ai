import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { ResourceList } from "@/components/resources";
import { RESOURCES } from "@/lib/safety/resources";

export const metadata: Metadata = { title: "Help resources" };

// Public on purpose: help is never behind sign-in.
export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <Brand />
      <main id="main" className="mt-8">
        <h1 className="text-3xl font-semibold">If you need to talk to someone now</h1>
        <p className="mt-2 text-ink-soft">
          These services are free and staffed by trained people. You don&apos;t need to be in crisis to reach out. If you or
          someone else is in immediate danger, contact your local emergency number.
        </p>
        <div className="mt-8 space-y-10">
          {Object.values(RESOURCES).map((region) => (
            <section key={region.country} aria-labelledby={`r-${region.country}`}>
              <h2 id={`r-${region.country}`} className="mb-3 text-xl font-semibold">{region.countryName}</h2>
              <ResourceList region={region} />
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
