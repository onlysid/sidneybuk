// Stand-in for next/navigation so the same components can run as a single-file preview.
import { useSyncExternalStore } from "react";

let path = "/";
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export const usePathname = () => useSyncExternalStore(subscribe, () => path, () => path);
const go = (href: string) => {
  path = href;
  listeners.forEach((l) => l());
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
};
// One router for the whole preview, so effects that depend on it do not run again on every draw.
const router = {
  push: go,
  replace: go,
  // The real one asks the server again; here the content is already live.
  refresh() {},
};
export const useRouter = () => router;
// So an address can be typed into the preview by hand (and by the tests): window.go("/music").
(window as unknown as { go: (href: string) => void }).go = go;
export const notFound = () => {
  throw new Error("not found");
};
