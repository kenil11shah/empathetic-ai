import { useEffect, type ComponentType } from "react";
import { navigate, usePathname, useHref } from "./shims/navigation";
import { previewAuth } from "./mock-api";
import { AppShell } from "@/components/app-shell";
import Landing from "@/app/page";
import HelpPage from "@/app/help/page";
import Privacy from "@/app/privacy/page";
import LoginPage from "@/app/login/page";
import Onboarding from "@/app/onboarding/page";
import NotFound from "@/app/not-found";
import Dashboard from "@/app/app/page";
import ChatPage from "@/app/app/chat/page";
import JournalPage from "@/app/app/journal/page";
import CheckinsPage from "@/app/app/checkins/page";
import TasksPage from "@/app/app/tasks/page";
import InsightsPage from "@/app/app/insights/page";
import WellnessPage from "@/app/app/wellness/page";
import SafetyPage from "@/app/app/safety/page";
import SettingsPage from "@/app/app/settings/page";

const PUBLIC: Record<string, ComponentType> = { "/": Landing, "/help": HelpPage, "/privacy": Privacy, "/login": LoginPage, "/onboarding": Onboarding };
const APP: Record<string, ComponentType> = {
  "/app": Dashboard, "/app/chat": ChatPage, "/app/journal": JournalPage, "/app/checkins": CheckinsPage, "/app/tasks": TasksPage,
  "/app/insights": InsightsPage, "/app/wellness": WellnessPage, "/app/safety": SafetyPage, "/app/settings": SettingsPage,
};

export function App() {
  const path = usePathname();
  const href = useHref();
  const needsAuth = path === "/onboarding" || path.startsWith("/app");
  const blocked = needsAuth && !previewAuth.isSignedIn();

  // Same job as the real app's proxy: signed-out visitors go to /login.
  useEffect(() => {
    if (blocked) navigate(`/login?next=${encodeURIComponent(path)}`);
  }, [blocked, path]);

  if (blocked) return null;
  const Page = APP[path] ?? PUBLIC[path];
  if (!Page) return <NotFound />;
  return (
    <div key={href.startsWith("/app/chat") ? "chat" : href}>
      {APP[path] ? (
        <AppShell>
          <Page />
        </AppShell>
      ) : (
        <Page />
      )}
    </div>
  );
}
