"use client";

import { useSite } from "@/components/Content";
import { useEffect, useRef, useState } from "react";
import data from "@/lib/github-data.json";
import { site } from "@/lib/site";
import { useLive } from "@/lib/live";
import { TLink } from "./Transition";
import { useOpenTerminal, useShortcut } from "./TerminalSheet";
import { usePathname } from "next/navigation";
import { playback, usePlayback } from "@/lib/playing";

type Track = { configured: boolean; playing?: boolean; title?: string; artist?: string; url?: string; art?: string; source?: string; sample?: boolean };
type Repo = { name: string; url: string; pushed: string };

const latest = [...data.repos].sort((a, b) => b.pushed.localeCompare(a.pushed))[0];

function ago(date: string) {
  const days = Math.max(0, Math.round((Date.now() - Date.parse(date)) / 86400000));
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} mo ago`;
  return `${Math.round(days / 365)} yr ago`;
}

// The bar that stays at the bottom of every page: what is playing, and the repository most recently pushed to.
function Slide({ title, children }: { title: string; children: React.ReactNode }) {
  const outer = useRef<HTMLElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [over, setOver] = useState(0);
  useEffect(() => {
    const measure = () => setOver(Math.max(0, (inner.current?.scrollWidth ?? 0) - (outer.current?.clientWidth ?? 0)));
    measure();
    const watch = new ResizeObserver(measure);
    if (outer.current) watch.observe(outer.current);
    return () => watch.disconnect();
  }, [title]);
  return (
    <b ref={outer} className="now-slide" title={title} data-over={over > 4} style={{ ["--over" as string]: `${-over}px`, ["--time" as string]: `${Math.max(6, over / 18 + 5)}s` }}>
      <span ref={inner}>{children}</span>
    </b>
  );
}

export function NowBar() {
  const site = useSite();
  // What is playing: asked every 20 seconds and whenever the tab is looked at again.
  const { data: heard } = useLive<Track>("/api/now-playing", { every: 20, remember: true });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const track = mounted ? heard : null;
  const [repo, setRepo] = useState<Repo>({ name: latest.name, url: latest.url, pushed: latest.pushed });
  const [when, setWhen] = useState("");

  useEffect(() => {
    let stop = false;
    if (site.workingOn.name) return;
    fetch(`https://api.github.com/users/${site.integrations.github}/repos?sort=pushed&per_page=1`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(([r]: { name: string; html_url: string; pushed_at: string }[]) => !stop && r && setRepo({ name: r.name, url: r.html_url, pushed: r.pushed_at }))
      .catch(() => {});
    return () => void (stop = true);
  }, []);
  // Worked out after mounting, so the server and the browser never disagree about today's date.
  useEffect(() => setWhen(ago(repo.pushed)), [repo]);

  const openTerminal = useOpenTerminal();
  const keys = useShortcut();
  const has = !!track?.title;
  const playing = has && !!track?.playing;
  const Listen = has && track?.url ? "a" : "div";

  const sound = usePlayback();
  useMedia();
  // The controls stay drawn while they slide away, showing what they last held.
  const held = useRef(sound);
  if (sound) held.current = sound;
  const shown = held.current;

  return (
    <aside className="now glass" data-single={!has} data-mode={sound ? "audio" : "now"} aria-label={sound ? "What is playing on this page" : "Right now"}>
      <div className="now-face" aria-hidden={!!sound || undefined} inert={!!sound || undefined}>
        {/* The listening half only appears once a music source is connected and has something to show. */}
        {has && (
          <>
            <Listen className="now-half" {...(Listen === "a" ? { href: track?.url, target: "_blank", rel: "noreferrer" } : {})} data-live={playing}>
              {track?.art ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="now-art" src={track.art} alt="" width={34} height={34} />
              ) : (
                <span className="now-eq" aria-hidden="true">
                  {[0, 1, 2, 3].map((n) => (
                    <i key={n} style={{ ["--i" as string]: n }} />
                  ))}
                </span>
              )}
              <span className="now-text">
                <small>
                  {playing ? "Now listening" : "Last played"}
                  {track?.sample ? " · sample" : ""}
                </small>
                <Slide key={track?.title} title={`${track?.title} · ${track?.artist}`}>
                  {track?.title}
                  <em> · {track?.artist}</em>
                </Slide>
              </span>
            </Listen>
            <i className="now-rule" aria-hidden="true" />
          </>
        )}
        {site.workingOn.name ? (
          <TLink className="now-half now-work" href={site.workingOn.href}>
            <span className="now-commit" aria-hidden="true">
              <i />
            </span>
            <span className="now-text">
              <small>
              <span className="now-long">Now </span>working on
            </small>
              <b>{site.workingOn.name}</b>
            </span>
          </TLink>
        ) : (
          <a className="now-half now-work" href={repo.url} target="_blank" rel="noreferrer">
            <span className="now-commit" aria-hidden="true">
              <i />
            </span>
            <span className="now-text">
              <small>
              <span className="now-long">Now </span>working on
            </small>
              <b key={repo.name}>
                {repo.name}
                {when && <em> · {when}</em>}
              </b>
            </span>
          </a>
        )}
        <button type="button" className="now-term" onClick={openTerminal} aria-label="Open the terminal" title={`Terminal (${keys})`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 8l4.500 4L5 16" />
            <path className="now-term-us" d="M12.500 16.500h6.500" />
          </svg>
        </button>
      </div>
      <div className="now-audio" aria-hidden={!sound || undefined} inert={!sound || undefined}>
        {shown && (
          <>
            <button type="button" className="now-play" data-playing={shown.playing} onClick={() => shown.toggle()} aria-label={shown.playing ? `Pause ${shown.title}` : `Play ${shown.title}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path className="now-play-bars" d="M7 5h3.500v14H7zM13.500 5H17v14h-3.500z" />
                <path className="now-play-go" d="M8 5l11 7-11 7z" />
              </svg>
            </button>
            <button type="button" className="now-audio-text" onClick={() => shown.show?.()} aria-label={`Show ${shown.title}`}>
              <small>
                <span>{shown.playing ? "Playing" : "Paused"}</span>
                <Meter />
              </small>
              <Slide key={shown.title} title={shown.sub ? `${shown.title} · ${shown.sub}` : shown.title}>
                {shown.title}
                {shown.sub && <em> · {shown.sub}</em>}
              </Slide>
            </button>
            <span className="now-wave" data-live={shown.playing} aria-hidden="true">
              {[0, 1, 2, 3, 4].map((n) => (
                <i key={n} style={{ ["--i" as string]: n }} />
              ))}
            </span>
            <button type="button" className="now-stop" onClick={() => shown.stop()} aria-label="Stop and close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M7 7l10 10M17 7L7 17" />
              </svg>
            </button>
            <Scrub seek={shown.seek} title={shown.title} />
          </>
        )}
      </div>
    </aside>
  );
}

// Where the music is, in words. Written straight onto the page as it changes.
function Meter() {
  const el = useRef<HTMLElement>(null);
  useEffect(() => playback.meter((p) => el.current && (el.current.textContent = p.label ? ` · ${p.label}` : "")), []);
  return <i ref={el} />;
}

// A thin line along the bottom of the bar: how far through, and a place to drag to move.
function Scrub({ seek, title }: { seek?: (f: number) => void; title: string }) {
  const el = useRef<HTMLInputElement>(null);
  const held = useRef(false);
  useEffect(
    () =>
      playback.meter((p) => {
        if (!el.current || held.current) return;
        el.current.value = String(Math.round(p.at * 1000));
        el.current.style.setProperty("--at", `${p.at * 100}%`);
      }),
    [],
  );
  return (
    <input
      ref={el}
      className="now-scrub"
      type="range"
      min={0}
      max={1000}
      defaultValue={0}
      disabled={!seek}
      aria-label={`Position in ${title}`}
      onPointerDown={() => (held.current = true)}
      onPointerUp={() => (held.current = false)}
      onPointerCancel={() => (held.current = false)}
      onInput={(e) => e.currentTarget.style.setProperty("--at", `${Number(e.currentTarget.value) / 10}%`)}
      onChange={(e) => seek?.(Number(e.currentTarget.value) / 1000)}
    />
  );
}

const clockOf = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "");

// Recordings and videos are ordinary media elements.
function useMedia() {
  const pathname = usePathname();
  useEffect(() => {
    const id = "media";
    let el: HTMLMediaElement | null = null;
    const mine = (e: Event) => {
      const t = e.target;
      return t instanceof HTMLMediaElement && !t.muted && !t.closest(".desk-page") && !t.dataset.noDock ? t : null;
    };
    const tick = () => el && playback.progress(id, el.duration ? el.currentTime / el.duration : 0, el.duration ? `${clockOf(el.currentTime)} / ${clockOf(el.duration)}` : clockOf(el.currentTime));
    const onPlay = (e: Event) => {
      const t = mine(e);
      if (!t) return;
      if (el && el !== t && !el.paused) el.pause();
      el = t;
      const title = t.dataset.title || t.getAttribute("aria-label") || t.closest("figure")?.querySelector("figcaption")?.textContent?.trim() || document.title.split(/ [·|—-] /)[0] || "This page";
      playback.set({
        id,
        title,
        sub: t instanceof HTMLVideoElement ? "video" : "recording",
        playing: true,
        toggle: () => (t.paused ? void t.play().catch(() => {}) : t.pause()),
        seek: (f) => t.duration && (t.currentTime = f * t.duration),
        stop: () => (t.pause(), playback.clear(id)),
        show: () => t.scrollIntoView({ behavior: "smooth", block: "center" }),
        alive: () => t.isConnected,
      });
      tick();
    };
    const onPause = (e: Event) => e.target === el && playback.patch(id, { playing: false });
    const onEnd = (e: Event) => e.target === el && playback.clear(id);
    const onTime = (e: Event) => e.target === el && tick();
    // Media events do not bubble, so they are caught on the way down.
    document.addEventListener("play", onPlay, true);
    document.addEventListener("pause", onPause, true);
    document.addEventListener("ended", onEnd, true);
    document.addEventListener("timeupdate", onTime, true);
    return () => {
      document.removeEventListener("play", onPlay, true);
      document.removeEventListener("pause", onPause, true);
      document.removeEventListener("ended", onEnd, true);
      document.removeEventListener("timeupdate", onTime, true);
    };
  }, []);
  // After moving to another page, let go of anything whose page has gone.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const now = playback.now();
      if (now?.alive && !now.alive()) playback.clear(now.id);
    }, 900);
    return () => window.clearTimeout(t);
  }, [pathname]);
}
