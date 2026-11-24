import type { Metadata } from "next";
import { Brand, Disclaimer } from "@/components/brand";

export const metadata: Metadata = { title: "Privacy & limits" };

const sections: [string, string[]][] = [
  ["What this is", [
    "Empathetic AI is a research prototype for everyday emotional well-being and self-management. It is an AI system, not a person, therapist or clinician.",
    "It does not diagnose, treat or monitor anyone, and it cannot contact emergency services or your contacts.",
  ]],
  ["What we store", [
    "Your account, the conversations you save, check-ins, journal entries, tasks and safety plan, so you can come back to them.",
    "Private conversations are not stored by this app. They are sent to the AI provider to generate a reply and then discarded by us.",
    "Raw voice recordings are sent to the transcription provider and are never written to our storage or database.",
    "Emotion hints, memory and chat-based insights are only stored if you turn them on. Memory is off by default.",
    "Guest accounts, and everything in them, are deleted automatically 30 days after they are created. Accounts with an email are kept until you delete them.",
  ]],
  ["Third-party processing", [
    "Messages are processed by the configured AI provider (by default Groq) and data is stored in Supabase. These providers have their own retention policies, so we don't promise zero retention on their side.",
    "We do not use your content to train models, and we do not sell or share it.",
  ]],
  ["Your controls", [
    "Edit or delete any item. View, edit or clear everything the assistant remembers. Export your data as JSON or text. Delete your account, which removes all active records immediately. Provider backups expire on their own schedule.",
  ]],
  ["Safety", [
    "An independent safety policy checks messages and replies. When someone may be at risk, the app shows verified help resources and encourages contact with real people. It never sends messages automatically.",
  ]],
];

export default function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <Brand />
      <main id="main" className="mt-8">
        <h1 className="text-3xl font-semibold">Privacy & limits</h1>
        <Disclaimer className="mt-3" />
        <div className="mt-8 space-y-8">
          {sections.map(([h, ps]) => (
            <section key={h}>
              <h2 className="text-xl font-semibold">{h}</h2>
              {ps.map((p) => <p key={p} className="mt-2 text-ink-soft">{p}</p>)}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
