"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Terminal } from "./toys/Terminal";

const Ctx = createContext<() => void>(() => {});
export const useOpenTerminal = () => useContext(Ctx);

// ⌘K on Apple devices, Ctrl K elsewhere. Worked out after mounting so the server and browser agree.
export function useShortcut() {
  const [keys, setKeys] = useState("Ctrl K");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setKeys("⌘K");
  }, []);
  return keys;
}

// The terminal, reachable from every page: the >_ button in the bar at the bottom, Ctrl/Cmd + K, or the / key.
export function TerminalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const show = useCallback(() => setOpen(true), []);
  const keys = useShortcut();

  useEffect(() => setOpen(false), [pathname]);
  // While the terminal is open the page behind it does not scroll.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const gap = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (gap > 0) root.style.paddingRight = `${gap}px`;
    return () => {
      root.style.overflow = "";
      root.style.paddingRight = "";
    };
  }, [open]);
  // While the terminal is open the page behind it does not scroll.
  const [touch, setTouch] = useState(false);
  const path = useRef(pathname);
  path.current = pathname;
  useEffect(() => {
    if (!open) return;
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    const { body, documentElement: root } = document;
    const y = window.scrollY;
    const opened = path.current;
    const gap = window.innerWidth - root.clientWidth;
    Object.assign(body.style, { position: "fixed", top: `${-y}px`, left: "0", right: "0", paddingRight: gap ? `${gap}px` : "" });
    return () => {
      Object.assign(body.style, { position: "", top: "", left: "", right: "", paddingRight: "" });
      window.scrollTo({ top: path.current === opened ? y : 0, behavior: "instant" });
    };
  }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as Element | null)?.closest?.("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || ((e.key === "`" || e.key === "/") && !typing)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {open && (
        <div className="term-back" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="term glass" role="dialog" aria-modal="true" aria-label="Terminal">
            <div className="term-head">
              <span className="mono">Terminal</span>
              <span className="term-keys mono">
                open with <kbd>{keys}</kbd> or <kbd>/</kbd> · close with <kbd>Esc</kbd>
              </span>
              <button type="button" className="term-close" onClick={() => setOpen(false)} aria-label="Close the terminal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {/* On touch screens the prompt is not focused, so the keyboard stays down until the visitor taps it. */}
            <Terminal autoFocus={!touch} key={String(touch)} />
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
