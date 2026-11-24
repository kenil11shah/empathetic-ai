// In-memory router that stands in for next/navigation inside the single-file preview.
import { useMemo, useSyncExternalStore } from "react";

let current = new URL("http://preview.local/");
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function navigate(href: string) {
  current = new URL(href, current);
  emit();
  if (typeof window !== "undefined") window.scrollTo(0, 0);
}
export const getPath = () => current.pathname;
export const getHref = () => current.pathname + current.search;

const router = {
  push: (h: string) => navigate(h),
  replace: (h: string) => navigate(h),
  back: () => navigate("/app"),
  forward: () => {},
  refresh: () => emit(),
  prefetch: () => {},
};
export function useRouter() {
  return router;
}
export function usePathname() {
  return useSyncExternalStore(subscribe, () => current.pathname, () => "/");
}
export function useSearchParams() {
  const s = useSyncExternalStore(subscribe, () => current.search, () => "");
  return useMemo(() => new URLSearchParams(s), [s]);
}
export function useHref() {
  return useSyncExternalStore(subscribe, getHref, () => "/");
}
export function redirect(h: string) {
  navigate(h);
}
export function notFound() {
  navigate("/404");
}
