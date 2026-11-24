import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Empathetic AI — a calm space to think things through", template: "%s · Empathetic AI" },
  description:
    "A safety-first, emotion-aware AI companion for everyday well-being: talk or type, feel heard, reflect, and turn challenges into small steps. Research prototype, not a clinical service.",
  openGraph: {
    title: "Empathetic AI",
    description: "Talk it through, reflect, and turn everyday challenges into small, manageable steps.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#F5F7F4", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-50 rounded-lg bg-ink px-3 py-2 text-white">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
