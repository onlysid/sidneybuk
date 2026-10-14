"use client";

import { EditHere } from "./EditHere";
import { useSite } from "@/components/Content";
import { usePathname, useRouter } from "next/navigation";
import { mutate } from "swr";
import { api } from "@/lib/admin/api";
import { useLive } from "@/lib/live";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { workBySlug } from "@/lib/portfolio";
import { disciplines, site, type Slug } from "@/lib/site";
import { DisciplineArt } from "./DisciplineArt";
import { Mark } from "./Mark";
import { SoundButton, SoundSwitch, ThemeButton, ThemeSwitch } from "./Toggles";
import { TLink } from "./Transition";

const PAGES = [
  { slug: "", title: "Home", short: "Start here." },
  ...disciplines.map((d) => ({ slug: d.slug as string, title: d.title as string, short: d.short as string })),
  { slug: "blog", title: "Blog", short: "Notes." },
  { slug: "contact", title: "Contact", short: "Say hello." },
];
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// The island: one piece of glass that is a small pill at rest and stretches into the menu.
export function Dock() {
  const site = useSite();
  const pathname = usePathname();
  // A piece of work counts as being on its subject's page (WheelTune is under Code), so the menu says so.
  const parts = pathname.replace(/^\/|\/$/g, "").split("/");
  const active = parts[0] === "work" ? (workBySlug(parts[1] ?? "")?.subject ?? "") : parts[0];
  // The admin area is not a page in the menu, but the bar still says where you are.
  const current = PAGES.find((p) => p.slug === active) ?? (active === "admin" ? { ...PAGES[0], slug: "admin", title: "Admin" } : PAGES[0]);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const router = useRouter();
  const { data: session } = useLive<{ signedIn: boolean }>("/api/admin/session", { every: 300 });
  const admin = pathname.startsWith("/admin") && !!session?.signedIn;
  const [size, setSize] = useState<{ bar: [number, number]; panel: [number, number] } | null>(null);
  const [blob, setBlob] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [labelWidth, setLabelWidth] = useState<number | null>(null);
  const label = useRef<HTMLSpanElement>(null);
  const word = useRef<HTMLSpanElement>(null);
  const measure = useRef(() => {});
  const root = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLAnchorElement | null)[]>([]);


  // Measure the bar and the panel whenever either changes, so the glass always knows where to spring to.
  useIsoLayoutEffect(() => {
    measure.current = () => {
      if (!bar.current || !panel.current) return;
      const settling = (word.current?.offsetWidth ?? 0) - (label.current?.offsetWidth ?? 0);
      const next = { bar: [bar.current.offsetWidth + settling, bar.current.offsetHeight], panel: [panel.current.offsetWidth, panel.current.offsetHeight] } as { bar: [number, number]; panel: [number, number] };
      setSize((old) => (old && old.bar[0] === next.bar[0] && old.bar[1] === next.bar[1] && old.panel[0] === next.panel[0] && old.panel[1] === next.panel[1] ? old : next));
    };
    measure.current();
    const ro = new ResizeObserver(() => measure.current());
    if (bar.current) ro.observe(bar.current);
    if (panel.current) ro.observe(panel.current);
    return () => ro.disconnect();
  }, []);

  // The page name sits in a box whose width is animated, so the button grows and shrinks to fit each name.
  useIsoLayoutEffect(() => {
    const fit = () => {
      if (word.current) setLabelWidth(word.current.offsetWidth);
      measure.current();
    };
    fit();
    document.fonts?.ready.then(fit);
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [current.title]);

  // Arriving on a new page folds the menu away (it has usually started closing already, on the tap).
  useEffect(() => {
    setOpen(false);
    setHover(null);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  // Two different marks: the current page keeps its own tinted pill, and a glass highlight flows to whichever row is under the pointer, fading away…
  useEffect(() => {
    const el = hover === null ? null : rows.current[hover];
    if (el) setBlob({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
  }, [hover, open, size]);

  const style = size ? { width: open ? Math.max(size.bar[0], size.panel[0]) : size.bar[0], height: open ? size.bar[1] + size.panel[1] : size.bar[1] } : undefined;

  return (
    <header className="dock-wrap" ref={root} style={{ ["--island" as string]: `${size?.bar[0] ?? 0}px` }}>
      <div className="island glass" data-open={open} data-ready={!!size} style={style}>
        <nav className="island-bar" ref={bar} aria-label="Main">
          <TLink className="dock-logo" href="/" aria-label="Home">
            <Mark id="dock" />
          </TLink>
          <TLink className="dock-btn dock-extra" href="/contact" aria-label="Contact" aria-current={active === "contact" ? "page" : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="6" width="17" height="12.5" rx="3" />
              <path d="M4.5 8l7.5 5.5L19.5 8" />
            </svg>
          </TLink>
          <SoundButton />
          <ThemeButton />
          <button className="dock-menu" type="button" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen(!open)}>
            <span className="dock-label" ref={label} style={labelWidth === null ? undefined : { width: labelWidth }}>
              <span key={current.title} className="dock-current" ref={word}>
                {current.title}
              </span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9.5l6 6 6-6" />
            </svg>
          </button>
        </nav>

        <div className="island-panel" id="site-menu" ref={panel} inert={!open} onPointerLeave={() => setHover(null)}>
          {blob && <span className="menu-blob" data-on={hover !== null} style={{ transform: `translate(${blob.left}px, ${blob.top}px)`, width: blob.width, height: blob.height }} aria-hidden="true" />}
          {PAGES.map((p, n) => (
            <TLink
              key={p.slug}
              href={`/${p.slug}`}
              className="menu-row"
              style={{ ["--i" as string]: n }}
              aria-current={p.slug === current.slug ? "page" : undefined}
              ref={(node: HTMLAnchorElement | null) => {
                rows.current[n] = node;
              }}
              onClick={() => setOpen(false)}
              onPointerEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
            >
              <span className="menu-art" aria-hidden="true">
                {p.slug === "" ? (
                  <Mark id={`row${n}`} />
                ) : p.slug === "contact" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="menu-mail">
                    <rect x="3.5" y="6" width="17" height="12.5" rx="3" />
                    <path d="M4.5 8l7.5 5.5L19.5 8" />
                  </svg>
                ) : p.slug === "blog" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="menu-mail">
                    <path d="M5 4.500h10l4 4V19.500H5zM14.500 4.500V9H19M8.500 12.500h7M8.500 16h5" />
                  </svg>
                ) : (
                  <DisciplineArt kind={p.slug as Slug} />
                )}
              </span>
              <b className="menu-text">{p.title}</b>
            </TLink>
          ))}
          <div className="menu-foot" style={{ ["--i" as string]: PAGES.length }}>
            <a href={site.resumeUrl} target="_blank" rel="noreferrer">
              Résumé
            </a>
            <a href={`https://github.com/${site.integrations.github}`} target="_blank" rel="noreferrer">
              GitHub
            </a>
            {/* On small screens the sound and theme switches live here instead of in the bar, and say what state they are in. */}
            <ThemeSwitch />
            <SoundSwitch />
          </div>
          {/* In the admin area: a strip of its own under the pages, saying I am signed in, with the two ways out. */}
          {admin && (
            <div className="menu-me" style={{ ["--i" as string]: PAGES.length + 1 }}>
              <TLink href="/admin" className="menu-tile" aria-current={pathname === "/admin" ? "page" : undefined} onClick={() => setOpen(false)}>
                <span className="switch-text">
                  <small>Signed in</small>
                  <b>Admin</b>
                </span>
                <span className="menu-tile-dot" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4.5" y="4.5" width="6" height="6" rx="1.6" />
                    <rect x="13.5" y="4.5" width="6" height="6" rx="1.6" />
                    <rect x="4.5" y="13.5" width="6" height="6" rx="1.6" />
                    <rect x="13.5" y="13.5" width="6" height="6" rx="1.6" />
                  </svg>
                </span>
              </TLink>
              <button
                type="button"
                className="menu-tile menu-tile-out"
                onClick={async () => {
                  setOpen(false);
                  await api.signOut().catch(() => {});
                  await mutate("/api/admin/session");
                  router.push("/");
                }}
              >
                <span className="switch-text">
                  <small>Done here</small>
                  <b>Sign out</b>
                </span>
                <span className="menu-tile-dot" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 5h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3" />
                    <path d="M10 8l-4 4 4 4M6 12h9" />
                  </svg>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
      {/* For me only, when signed in: a small blob beside the island that goes to where this page is edited. */}
      {!open && <EditHere />}
    </header>
  );
}
