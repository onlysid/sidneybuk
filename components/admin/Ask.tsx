"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// The admin area's own "are you sure?" and "what should it be called?" boxes.
type Asking =
  | { kind: "confirm"; message: string; yes: string; danger: boolean; done: (ok: boolean) => void }
  | { kind: "text"; message: string; value: string; yes: string; done: (value: string | null) => void };

let show: ((a: Asking | null) => void) | null = null;

// Resolves true if I said yes. With nowhere to show the box (it should never happen) it says no.
export function confirmBox(message: string, { yes = "Delete", danger = true }: { yes?: string; danger?: boolean } = {}) {
  return new Promise<boolean>((done) => (show ? show({ kind: "confirm", message, yes, danger, done }) : done(false)));
}
// Resolves the text typed, or null if I backed out.
export function textBox(message: string, value = "", yes = "Save") {
  return new Promise<string | null>((done) => (show ? show({ kind: "text", message, value, yes, done }) : done(null)));
}

export function AskHost() {
  const [asking, setAsking] = useState<Asking | null>(null);
  const [typed, setTyped] = useState("");
  const main = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    show = (a) => {
      setTyped(a?.kind === "text" ? a.value : "");
      setAsking(a);
    };
    return () => void (show = null);
  }, []);
  useEffect(() => {
    if (!asking) return;
    (asking.kind === "text" ? field.current : main.current)?.focus({ preventScroll: true });
    field.current?.select();
    // While the box is up, the page behind it stays exactly where it is.
    const root = document.documentElement;
    const was = root.style.overflow;
    root.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => e.key === "Escape" && answer(false);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      root.style.overflow = was;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asking]);
  if (!asking) return null;
  const answer = (ok: boolean) => {
    if (asking.kind === "confirm") asking.done(ok);
    else asking.done(ok ? typed : null);
    setAsking(null);
  };
  // Put straight into <body>, so it covers the whole window whatever the page inside is doing, and closed on a finished tap (not the start of one), so…
  return createPortal(
    <div
      className="ask"
      role="presentation"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        e.stopPropagation();
        answer(false);
      }}
      onTouchMove={(e) => e.target === e.currentTarget && e.preventDefault()}
    >
      <form
        className="ask-box glass"
        role="alertdialog"
        aria-modal="true"
        aria-label={asking.message}
        onSubmit={(e) => {
          e.preventDefault();
          answer(true);
        }}
      >
        <p>{asking.message}</p>
        {asking.kind === "text" && <input ref={field} value={typed} onChange={(e) => setTyped(e.target.value.replace(/^\s+/, ""))} aria-label={asking.message} autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="done" />}
        <div className="ask-row">
          <button type="button" className="desk-btn desk-quiet" onClick={() => answer(false)}>
            Cancel
          </button>
          <button ref={main} type="submit" className={`desk-btn ${asking.kind === "confirm" && asking.danger ? "desk-danger ask-danger" : "desk-main"}`}>
            {asking.yes}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

// A sheet: a small form that comes up over the page for one job, and goes away when it is done.
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const f = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setLive(true)));
      return () => window.cancelAnimationFrame(f);
    }
    setLive(false);
    const t = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(t);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement, was = root.style.overflow;
    root.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => {
      root.style.overflow = was;
      window.removeEventListener("keydown", key);
    };
  }, [open, onClose]);
  // Keep the sheet inside the part of the screen that can actually be seen: when the keyboard comes up, or the browser's bars move, the sheet shrinks…
  const back = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mounted) return;
    const vv = window.visualViewport;
    const fit = () => {
      const el = back.current;
      if (!el) return;
      // Only when something (the keyboard) has really taken a bite out of the screen.
      if (vv && vv.height < window.innerHeight - 80) {
        el.style.setProperty("--sheet-h", `${Math.round(vv.height)}px`);
        el.style.setProperty("--sheet-top", `${Math.round(vv.offsetTop)}px`);
      } else {
        el.style.removeProperty("--sheet-h");
        el.style.removeProperty("--sheet-top");
      }
    };
    fit();
    const f = window.requestAnimationFrame(fit);
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    window.addEventListener("resize", fit);
    return () => {
      window.cancelAnimationFrame(f);
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
    };
  }, [mounted]);
  if (!mounted) return null;
  return createPortal(
    <div className="sheet" ref={back} data-open={live} role="presentation" onClick={(e) => e.target === e.currentTarget && (e.preventDefault(), onClose())}>
      <div className="sheet-box glass" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <b>{title}</b>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
