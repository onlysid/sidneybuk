"use client";

import { Pill } from "@/components/Pill";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useContent } from "@/components/Content";
import { TLink, useGo } from "@/components/Transition";
import { notesIn, searchNotes, type Subject, type Topic } from "@/lib/learning";

// The parts of the notebook that get you around it: the bar that follows you down the page, the sheet that lists (and searches) everything, and a…
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

const ART: Record<string, React.ReactNode> = {
  languages: (
    <>
      <path d="M8 14h26a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H22l-8 7v-7H8a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z" />
      <path d="M44 26h8a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6h-2v6l-7-6h-9" />
      <path d="M12 23h18M12 29h11" />
    </>
  ),
  "music-theory": (
    <>
      <path d="M6 20h52M6 28h52M6 36h52M6 44h52" opacity="0.5" />
      <ellipse cx="22" cy="44" rx="6" ry="4.500" transform="rotate(-20 22 44)" fill="currentColor" />
      <path d="M27.500 42V14" />
      <ellipse cx="42" cy="36" rx="6" ry="4.500" transform="rotate(-20 42 36)" fill="currentColor" />
      <path d="M47.500 34V8M27.500 14l20-6" />
    </>
  ),
  maths: (
    <>
      <path d="M8 52V10M8 52h48" opacity="0.5" />
      <path d="M10 46c8-2 10-30 20-30s10 24 24 26" />
      <circle cx="30" cy="16" r="3" fill="currentColor" />
    </>
  ),
  physics: (
    <>
      <ellipse cx="32" cy="32" rx="26" ry="10" />
      <ellipse cx="32" cy="32" rx="26" ry="10" transform="rotate(60 32 32)" />
      <ellipse cx="32" cy="32" rx="26" ry="10" transform="rotate(120 32 32)" />
      <circle cx="32" cy="32" r="4" fill="currentColor" />
    </>
  ),
  "computer-science": (
    <>
      <circle cx="32" cy="12" r="6" />
      <circle cx="16" cy="34" r="6" />
      <circle cx="48" cy="34" r="6" />
      <circle cx="8" cy="54" r="4.500" />
      <circle cx="24" cy="54" r="4.500" />
      <circle cx="48" cy="54" r="4.500" />
      <path d="M28 17l-8 12M36 17l8 12M13 39l-3 10M19 39l3 10M48 40v9" />
    </>
  ),
  philosophy: (
    <>
      <path d="M32 6c-12 0-20 8-20 19 0 7 4 12 8 16v7h24v-7c4-4 8-9 8-16 0-11-8-19-20-19z" />
      <path d="M24 56h16M26 34c2-6 10-6 12 0M32 34v14" />
    </>
  ),
};
// A subject without a drawing of its own gets an open book.
const BOOK = (
  <>
    <path d="M32 16c-6-5-14-6-24-6v38c10 0 18 1 24 6 6-5 14-6 24-6V10c-10 0-18 1-24 6z" />
    <path d="M32 16v38" />
  </>
);
export function SubjectArt({ slug }: { slug: string }) {
  return (
    <svg className="nb-art" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ART[slug] ?? BOOK}
    </svg>
  );
}
const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const LIST = "M4 6h16M4 12h16M4 18h10";
const GLASS = "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.500-3.500";
const DOWN = "M6 9l6 6 6-6";

// ---- Things that fade up as they come into view ---- Whatever is already on screen is left alone (the page's own entrance covers it); the rest…
export function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"" | "wait" | "in">("");
  useIso(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.95) return;
    setState("wait");
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setState("in");
        io.disconnect();
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} data-reveal={state || undefined}>
      {children}
    </div>
  );
}

// A row of choices with a pill that slides to the chosen one.
export function Tabs({ label, value, options, onChange }: { label: string; value: string; options: (readonly [string, React.ReactNode])[]; onChange: (v: string) => void }) {
  return (
    <div className="seg nb-tabs" role="tablist" aria-label={label}>
      <Pill />
      {options.map(([v, text]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} aria-pressed={value === v} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

// ---- The sheet that lists and searches the whole notebook ----
type Here = { subject?: string; topic?: string; href?: string };
const Jump = createContext<(search?: boolean) => void>(() => {});
export const useJump = () => useContext(Jump);

type Hit = { href: string; title: string; where: string; kind: "Subject" | "Topic" | "Note"; more?: string };

function Sheet({ search, here, onClose }: { search: boolean; here: Here; onClose: () => void }) {
  const { subjects, topics, notes } = useContent();
  const go = useGo();
  const [q, setQ] = useState("");
  const [unfolded, setUnfolded] = useState<string>(here.subject ?? "");
  const [at, setAt] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setLeaving(true);
    window.setTimeout(onClose, 240);
  }, [onClose]);

  // Hold the page still behind the sheet, and keep the sheet above the phone's keyboard.
  useEffect(() => {
    const root = document.documentElement;
    const was = root.style.overflow;
    root.style.overflow = "hidden";
    const vv = window.visualViewport;
    const fit = () => {
      if (!vv || !panel.current) return;
      panel.current.style.setProperty("--kb", `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`);
      panel.current.style.setProperty("--vvh", `${vv.height}px`);
    };
    fit();
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    const wide = window.matchMedia("(min-width: 700px)").matches;
    if (search || wide) field.current?.focus({ preventScroll: true });
    else panel.current?.focus({ preventScroll: true });
    // Bring the page you are on into view in the list.
    list.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "center" });
    return () => {
      root.style.overflow = was;
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
    };
  }, [search]);

  const hits = useMemo<Hit[]>(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const has = (text: string) => words.every((w) => text.toLowerCase().includes(w));
    const name = (slug: string) => subjects.find((s) => s.slug === slug)?.title ?? slug;
    return [
      ...subjects.filter((s) => has(s.title)).map((s) => ({ href: `/learning/${s.slug}`, title: s.title, where: "Notebook", kind: "Subject" as const })),
      ...topics.filter((t) => has(`${t.title} ${t.short}`)).map((t) => ({ href: `/learning/${t.subject}/${t.slug}`, title: t.title, where: name(t.subject), kind: "Topic" as const })),
      ...searchNotes(notes, q).map((n) => ({
        href: `/learning/${n.subject}/${n.slug}`,
        title: n.title,
        where: topics.find((t) => t.subject === n.subject && t.slug === n.topic)?.title ?? name(n.subject),
        kind: "Note" as const,
        more: n.summary,
      })),
    ].slice(0, 30);
  }, [q, subjects, topics, notes]);
  useEffect(() => setAt(0), [q]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[data-at="true"]')?.scrollIntoView({ block: "nearest" });
  }, [at]);

  // Pull the sheet down by its handle to put it away.
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const pull = {
    onPointerDown: (e: React.PointerEvent) => {
      drag.current = { y: e.clientY, dy: 0 };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!drag.current || !panel.current) return;
      drag.current.dy = Math.max(0, e.clientY - drag.current.y);
      panel.current.style.transition = "none";
      panel.current.style.translate = `0 ${drag.current.dy}px`;
    },
    onPointerUp: () => {
      if (!drag.current || !panel.current) return;
      const far = drag.current.dy > 90;
      drag.current = null;
      panel.current.style.transition = "";
      if (far) close();
      else panel.current.style.translate = "";
    },
  };

  const row = (href: string, label: string, kind: string, extra?: React.ReactNode) => (
    <TLink key={href} href={href} className="nbj-link" data-kind={kind} aria-current={href === here.href ? "page" : undefined} onClick={onClose}>
      <span>{label}</span>
      {extra}
    </TLink>
  );

  return createPortal(
    <div className="nbj-back" data-leaving={leaving} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className="nbj"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Find your way around the notebook"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") (e.preventDefault(), close());
          else if (hits.length && e.key === "ArrowDown") (e.preventDefault(), setAt((a) => (a + 1) % hits.length));
          else if (hits.length && e.key === "ArrowUp") (e.preventDefault(), setAt((a) => (a - 1 + hits.length) % hits.length));
          else if (hits.length && e.key === "Enter" && e.target === field.current) (e.preventDefault(), onClose(), go(hits[at].href));
        }}
      >
        <div className="nbj-grab" {...pull} aria-hidden="true">
          <i />
        </div>
        <div className="nbj-top">
          <label className="nbj-field">
            <Icon d={GLASS} />
            <input ref={field} type="search" enterKeyHint="go" placeholder="Search the notebook" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the notebook" autoComplete="off" autoCorrect="off" spellCheck={false} />
          </label>
          <button type="button" className="nbj-close mono" onClick={close}>
            Close
          </button>
        </div>
        <div className="nbj-list" ref={list}>
          {q.trim() ? (
            hits.length ? (
              hits.map((h, k) => (
                <TLink key={h.href} href={h.href} className="nbj-hit" data-at={k === at} onClick={onClose} onPointerMove={() => setAt(k)}>
                  <span className="mono">
                    {h.kind} · {h.where}
                  </span>
                  <b>{h.title}</b>
                  {h.more && <span>{h.more}</span>}
                </TLink>
              ))
            ) : (
              <p className="nbj-none">Nothing in the notebook matches “{q.trim()}”.</p>
            )
          ) : (
            <>
              {row("/learning", "The whole notebook", "home")}
              {subjects.map((s) => {
                const inside = topics.filter((t) => t.subject === s.slug);
                const loose = notesIn(notes, s.slug, "");
                const open = unfolded === s.slug;
                const count = notes.filter((n) => n.subject === s.slug).length;
                return (
                  <div key={s.slug} className="nbj-subject" data-open={open} data-here={here.subject === s.slug}>
                    <button type="button" className="nbj-fold" aria-expanded={open} onClick={() => setUnfolded(open ? "" : s.slug)}>
                      <SubjectArt slug={s.slug} />
                      <b>{s.title}</b>
                      <span className="mono">
                        {inside.length ? `${inside.length} ${inside.length === 1 ? "topic" : "topics"} · ` : ""}
                        {count} {count === 1 ? "note" : "notes"}
                      </span>
                      <Icon d={DOWN} />
                    </button>
                    <div className="nbj-inside">
                      <div>
                        {row(`/learning/${s.slug}`, `About ${s.title}`, "about")}
                        {inside.map((t) => (
                          <div key={t.slug} className="nbj-group">
                            {row(`/learning/${t.subject}/${t.slug}`, t.title, "topic", t.level ? <i className="mono">{t.level}</i> : null)}
                            {notesIn(notes, t.subject, t.slug)
                              .reverse()
                              .map((n) => row(`/learning/${n.subject}/${n.slug}`, n.title, "note"))}
                          </div>
                        ))}
                        {loose.length > 0 && (
                          <div className="nbj-group">
                            {inside.length > 0 && (
                              <span className="nbj-link" data-kind="label">
                                Other notes
                              </span>
                            )}
                            {loose.reverse().map((n) => row(`/learning/${n.subject}/${n.slug}`, n.title, "note"))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Wraps a notebook page: holds the sheet, and opens it on "/" or Ctrl/Cmd + K.
export function NotebookNav({ here = {}, children }: { here?: Here; children: React.ReactNode }) {
  const [open, setOpen] = useState<null | "browse" | "search">(null);
  const show = useCallback((search = false) => setOpen(search ? "search" : "browse"), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey)) {
        e.preventDefault();
        setOpen("search");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <Jump.Provider value={show}>
      {children}
      {open && <Sheet search={open === "search"} here={here} onClose={() => setOpen(null)} />}
    </Jump.Provider>
  );
}

// What looks like a search box on the notebook's front page: it opens the sheet.
export function JumpField() {
  const jump = useJump();
  return (
    <div className="nb-jump">
      <button type="button" className="nb-jump-field" onClick={() => jump(true)}>
        <Icon d={GLASS} />
        <span>Search notes</span>
        <kbd className="mono">/</kbd>
      </button>
      <button type="button" className="nb-jump-browse" onClick={() => jump(false)}>
        <Icon d={LIST} />
        <span>Contents</span>
      </button>
    </div>
  );
}

// The bar at the bottom of every page of the notebook, where the rest of the site has "now listening": contents, where you are, search.
export function NotebookBar({ subject, topic, title }: { subject?: Subject; topic?: Topic; title?: string }) {
  const jump = useJump();
  const path = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  // On a narrow bar, show the end of the path: where you are matters more than where you came from.
  useIso(() => {
    if (path.current) path.current.scrollLeft = path.current.scrollWidth;
  }, [ready, subject?.slug, topic?.slug, title]);
  if (!ready) return null;
  const sep = <i aria-hidden="true">›</i>;
  return createPortal(
    <div className="nb-bar">
      <button type="button" className="nb-bar-btn" onClick={() => jump(false)} aria-label="Contents of the notebook">
        <Icon d={LIST} />
        <span className="mono">Contents</span>
      </button>
      <nav className="nb-path mono" ref={path} aria-label="Where you are">
        {subject ? <TLink href="/learning">Notebook</TLink> : <b aria-current="page">Notebook</b>}
        {subject && (
          <>
            {sep}
            {topic || title ? <TLink href={`/learning/${subject.slug}`}>{subject.title}</TLink> : <b aria-current="page">{subject.title}</b>}
          </>
        )}
        {topic && (
          <>
            {sep}
            {title ? <TLink href={`/learning/${topic.subject}/${topic.slug}`}>{topic.title}</TLink> : <b aria-current="page">{topic.title}</b>}
          </>
        )}
        {title && (
          <>
            {sep}
            <b aria-current="page">{title}</b>
          </>
        )}
      </nav>
      <button type="button" className="nb-bar-btn" onClick={() => jump(true)} aria-label="Search the notebook">
        <Icon d={GLASS} />
        <span className="mono">Search</span>
      </button>
    </div>,
    document.body,
  );
}

// "On this page": the headings of a note, with the one you are reading marked.
export function Toc({ heads, side = false }: { heads: { id: string; text: React.ReactNode; depth: number }[]; side?: boolean }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState("");
  useEffect(() => {
    const scroll = () => {
      let cur = "";
      for (const h of heads) {
        const el = document.getElementById(h.id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.35) cur = h.id;
      }
      setNow(cur);
    };
    scroll();
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, [heads]);
  const links = heads.map((h) => (
    <a
      key={h.id}
      href={`#${h.id}`}
      data-depth={h.depth}
      data-now={now === h.id}
      onClick={(e) => {
        setOpen(false);
        // Go there ourselves, so it works the same everywhere and lands clear of the bar at the top.
        const el = document.getElementById(h.id);
        if (!el) return;
        e.preventDefault();
        const top = el.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        history.replaceState(null, "", `#${h.id}`);
      }}
    >
      {h.text}
    </a>
  ));
  if (side)
    return (
      <aside className="nb-toc-side" aria-label="On this page">
        <span className="mono">On this page</span>
        {links}
      </aside>
    );
  return (
    <nav className="nb-toc glass" aria-label="On this page" data-open={open}>
      <button type="button" className="mono" aria-expanded={open} onClick={() => setOpen(!open)}>
        On this page · {heads.length}
        <Icon d={DOWN} />
      </button>
      <div className="nb-toc-fold">
        <div>{links}</div>
      </div>
    </nav>
  );
}
