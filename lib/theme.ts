// The light/dark choice, shared by the menu, the terminal and anything else that wants to flip it.
export type Theme = "light" | "dark";
const listeners = new Set<(t: Theme) => void>();

export const currentTheme = (): Theme => (document.documentElement.dataset.theme as Theme | undefined) ?? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

// Switches theme.
export function setTheme(next: Theme, from?: { x: number; y: number }) {
  const root = document.documentElement;
  const apply = () => {
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private windows can refuse storage; the switch still works for this visit.
    }
    listeners.forEach((l) => l(next));
  };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
  if (!doc.startViewTransition || !from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
  root.style.setProperty("--tx", `${from.x}px`);
  root.style.setProperty("--ty", `${from.y}px`);
  root.dataset.theming = "on";
  const done = () => delete root.dataset.theming;
  doc.startViewTransition(apply).finished.then(done, done);
}
export const toggleTheme = (from?: { x: number; y: number }) => setTheme(currentTheme() === "light" ? "dark" : "light", from);
export function onTheme(listener: (t: Theme) => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
