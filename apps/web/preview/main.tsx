import { useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./preview.css";
import { installMockApi, previewAuth } from "./mock-api";
import { App } from "./App";
import { navigate } from "./shims/navigation";

installMockApi();

function Banner() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="fixed right-3 top-16 z-50 max-w-[19rem] rounded-2xl border border-line bg-surface/95 px-3 py-2 pr-7 text-xs text-ink-soft shadow-lg backdrop-blur lg:top-3">
      <button aria-label="Hide preview note" onClick={() => setOpen(false)} className="absolute right-2 top-1.5 text-base leading-none text-muted hover:text-ink">×</button>
      <span className="font-semibold text-ink">Interactive preview.</span> Runs in your browser with the real safety, emotion and insights code. AI replies are demo templates, voice and downloads need the deployed app.{" "}
      <button className="font-medium text-teal underline" onClick={() => { previewAuth.reset(); navigate("/"); }}>Reset</button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Banner />
  </>,
);
