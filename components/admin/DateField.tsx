"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const two = (n: number) => String(n).padStart(2, "0");
const parts = (v: string) => {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(v);
  return m ? { y: +m[1], m: +m[2] - 1, d: m[3] ? +m[3] : 0 } : null;
};
// Written by hand so the server and the browser never disagree about how a date reads.
const say = (v: string, month: boolean) => {
  const p = parts(v);
  if (!p) return "";
  if (month || !p.d) return `${MONTHS[p.m]} ${p.y}`;
  return `${p.d} ${MONTHS[p.m].slice(0, 3)} ${p.y}`;
};

// `loose` lets a whole month be chosen from the calendar as well as a day, for things only roughly dated.
export function DateField({ id, value, onChange, month = false, loose = false, clearable = true, placeholder }: { id?: string; value: string; onChange: (v: string) => void; month?: boolean; loose?: boolean; clearable?: boolean; placeholder?: string }) {
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [live, setLive] = useState(false);
  const [spot, setSpot] = useState<{ left: number; top: number; up: boolean } | null>(null);
  const [view, setView] = useState({ y: 2026, m: 0 });
  const [dir, setDir] = useState(0);
  const chosen = parts(value);

  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const now = new Date();
    setView(chosen ? { y: chosen.y, m: chosen.m } : { y: now.getFullYear(), m: now.getMonth() });
    setDir(0);
    const wide = 304, tall = month ? 256 : 396;
    const below = window.innerHeight - r.bottom;
    const up = below < tall + 16 && r.top > below;
    setSpot({ left: Math.max(10, Math.min(r.left, window.innerWidth - wide - 10)), top: Math.max(10, Math.min(up ? r.top - tall - 8 : r.bottom + 8, window.innerHeight - tall - 10)), up });
    setOpen(true);
  };
  useEffect(() => {
    if (open) {
      setMounted(true);
      const f = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setLive(true)));
      return () => window.cancelAnimationFrame(f);
    }
    setLive(false);
    const t = window.setTimeout(() => setMounted(false), 240);
    return () => window.clearTimeout(t);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) => !!btn.current?.contains(t as Node) || !!panel.current?.contains(t as Node);
    const away = (e: PointerEvent) => !inside(e.target) && setOpen(false);
    const since = Date.now();
    const moved = (e: Event) => Date.now() - since > 250 && !panel.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setOpen(false), btn.current?.focus());
    window.addEventListener("pointerdown", away);
    window.addEventListener("scroll", moved, true);
    window.addEventListener("resize", moved);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("scroll", moved, true);
      window.removeEventListener("resize", moved);
      window.removeEventListener("keydown", key, true);
    };
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    btn.current?.focus();
  };
  const step = (by: number) => {
    setDir(by);
    setView((v) => (month ? { y: v.y + by, m: v.m } : { y: v.y + Math.floor((v.m + by) / 12), m: (((v.m + by) % 12) + 12) % 12 }));
  };
  const today = new Date();
  const isToday = (y: number, m: number, d: number) => y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
  const first = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length }, (_, k) => k + 1)];
  const text = say(value, month);

  return (
    <>
      <button type="button" id={id} ref={btn} className="dp-btn" data-open={open} data-empty={!text} aria-haspopup="dialog" aria-expanded={open} onClick={() => (open ? setOpen(false) : show())}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="5.500" width="16" height="14.500" rx="3.500" />
          <path d="M4 10h16M8.500 3.500v4M15.500 3.500v4" />
        </svg>
        <span>{text || placeholder || (month ? "Choose a month" : loose ? "Choose a day or a month" : "Choose a date")}</span>
      </button>
      {mounted &&
        spot &&
        createPortal(
          <div ref={panel} className="dp glass" data-open={open && live} data-up={spot.up} role="dialog" aria-label={month ? "Choose a month" : "Choose a date"} style={{ left: spot.left, top: spot.top }}>
            <div className="dp-head">
              <button type="button" onClick={() => step(-1)} aria-label={month ? "The year before" : "The month before"}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.500 6l-6 6 6 6" /></svg>
              </button>
              <b key={`${view.y}-${view.m}`} data-dir={dir}>{month ? view.y : `${MONTHS[view.m]} ${view.y}`}</b>
              <button type="button" onClick={() => step(1)} aria-label={month ? "The year after" : "The month after"}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.500 6l6 6-6 6" /></svg>
              </button>
            </div>
            {month ? (
              <div className="dp-months" key={view.y} data-dir={dir}>
                {MONTHS.map((name, m) => (
                  <button key={name} type="button" aria-pressed={chosen?.y === view.y && chosen.m === m} data-today={view.y === today.getFullYear() && m === today.getMonth()} onClick={() => pick(`${view.y}-${two(m + 1)}`)}>
                    {name.slice(0, 3)}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="dp-week" aria-hidden="true">
                  {DAYS.map((d) => (
                    <span key={d}>{d.slice(0, 2)}</span>
                  ))}
                </div>
                <div className="dp-days" key={`${view.y}-${view.m}`} data-dir={dir}>
                  {cells.map((d, k) =>
                    d === null ? (
                      <span key={`g${k}`} />
                    ) : (
                      <button key={d} type="button" aria-pressed={chosen?.y === view.y && chosen.m === view.m && chosen.d === d} data-today={isToday(view.y, view.m, d)} onClick={() => pick(`${view.y}-${two(view.m + 1)}-${two(d)}`)}>
                        {d}
                      </button>
                    ),
                  )}
                </div>
              </>
            )}
            <div className="dp-foot">
              <button type="button" onClick={() => pick(month ? `${today.getFullYear()}-${two(today.getMonth() + 1)}` : `${today.getFullYear()}-${two(today.getMonth() + 1)}-${two(today.getDate())}`)}>
                {month ? "This month" : "Today"}
              </button>
              {loose && !month && (
                <button type="button" className="dp-whole" aria-pressed={!!chosen && !chosen.d && chosen.y === view.y && chosen.m === view.m} onClick={() => pick(`${view.y}-${two(view.m + 1)}`)}>
                  All of {MONTHS[view.m].slice(0, 3)}
                </button>
              )}
              {clearable && value && (
                <button type="button" onClick={() => pick("")}>
                  Clear
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
