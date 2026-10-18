"use client";

import { Pic } from "./Pic";
import { Pill } from "@/components/Pill";
import { Empty } from "./Empty";
import { useSite } from "@/components/Content";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { meterFor, paint } from "@/components/toys/Camera";
import type { Frame, Project } from "@/lib/film";
import { site } from "@/lib/site";
import { Tilt } from "./Tilt";
import { TLink } from "./Transition";

// One picture: a real photograph if the frame has one, otherwise a generated landscape standing in for it.
export function Picture({ frame, alt = "", full, upTo = 640 }: { frame: Frame; alt?: string; full?: boolean; upTo?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const g = el?.getContext("2d");
    if (!el || !g || frame.src) return;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      el.width = Math.round(el.clientWidth * dpr);
      el.height = Math.round(el.clientHeight * dpr);
      const seed = frame.seed ?? 1;
      if (el.width && el.height) paint(g, el.width, el.height, seed, { iso: 200, aperture: 8, shutter: meterFor(seed, 200, 8) });
    };
    draw();
    const watch = new ResizeObserver(draw);
    watch.observe(el);
    return () => watch.disconnect();
  }, [frame.seed, frame.src]);
  // eslint-disable-next-line @next/next/no-img-element
  return frame.src ? (
    full ? <img src={frame.src} alt={alt || frame.caption || ""} decoding="async" /> : <Pic src={frame.src} alt={alt || frame.caption || ""} upTo={upTo} sizes="(max-width: 640px) 50vw, 33vw" />
  ) : <canvas ref={canvas} role="img" aria-label={alt || frame.caption || "A generated landscape, standing in for a photograph"} />;
}

const longDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const KINDS = ["All", "Trip", "Photos", "Video"] as const;
const PLURAL = { All: "Everything", Trip: "Trips", Photos: "Photos", Video: "Videos" };

// The projects, as a wall of covers you can filter.
export function ProjectWall({ projects }: { projects: Project[] }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]>("All");
  const list = projects.filter((p) => kind === "All" || p.kind === kind);
  if (!projects.length) return <Empty title="No projects yet">Trips, sets of photographs and videos will show here as I add them.</Empty>;
  return (
    <div className="fp-wall">
      <div className="seg" role="group" aria-label="Kind of project">
          <Pill />
        {KINDS.map((k) => (
          <button key={k} type="button" aria-pressed={k === kind} onClick={() => setKind(k)}>
            {PLURAL[k]}
          </button>
        ))}
      </div>
      <div className="fp-grid">
        {list.map((p) => (
          <Tilt key={p.slug} className="fp-tilt" max={5}>
            <TLink href={`/film/projects/${p.slug}`} className="fp-card glass">
              <span className="fp-cover">
                <Picture frame={p.cover} alt={p.title} />
                <span className="fp-kind mono">{p.kind}</span>
                {p.kind === "Video" && (
                  <span className="fp-play" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5l11 7-11 7z" />
                    </svg>
                  </span>
                )}
              </span>
              <span className="fp-text">
                <b>{p.title}</b>
                <span className="mono">
                  {p.place ? `${p.place} · ` : ""}
                  {longDate(p.date)}
                  {p.kind !== "Video" ? ` · ${p.frames.length} frames` : ""}
                </span>
                <span>{p.note}</span>
                {p.sample && <i className="post-tag sample">sample</i>}
              </span>
            </TLink>
          </Tilt>
        ))}
      </div>
    </div>
  );
}

// A grid of frames. Tapping one opens it large; arrows and swipes move between them.
export function Gallery({ frames }: { frames: Frame[] }) {
  const [open, setOpen] = useState(-1);
  useEffect(() => {
    if (open < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(-1);
      if (e.key === "ArrowRight") setOpen((k) => (k + 1) % frames.length);
      if (e.key === "ArrowLeft") setOpen((k) => (k - 1 + frames.length) % frames.length);
    };
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, frames.length]);
  const swipe = useRef(0);
  return (
    <>
      <div className="fp-frames">
        {frames.map((f, k) => (
          <button key={k} type="button" className="fp-frame" data-shape={f.shape} onClick={() => setOpen(k)} aria-label={`Open ${f.caption ?? `frame ${k + 1}`}`}>
            <Picture frame={f} />
            {f.caption && <span>{f.caption}</span>}
          </button>
        ))}
      </div>
      {/* Rendered on <body>, not inside the page: the page animates with a transform, and a "fixed" box inside a transformed one is fixed to that box, which is why this used to open off-screen when scrolled down. */}
      {open >= 0 &&
        createPortal(
        <div
          className="fp-light"
          role="dialog"
          aria-modal="true"
          aria-label={frames[open].caption ?? `Frame ${open + 1} of ${frames.length}`}
          onClick={() => setOpen(-1)}
          onTouchStart={(e) => (swipe.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - swipe.current;
            if (Math.abs(dx) > 50) setOpen((k) => (k + (dx < 0 ? 1 : -1) + frames.length) % frames.length);
          }}
        >
          <figure key={open} onClick={(e) => e.stopPropagation()}>
            <Picture frame={frames[open]} full />
            <figcaption className="mono">
              {open + 1} / {frames.length}
              {frames[open].caption ? ` · ${frames[open].caption}` : ""}
            </figcaption>
          </figure>
          <button type="button" className="fp-light-x" aria-label="Close" onClick={() => setOpen(-1)}>
            ×
          </button>
          <button type="button" className="fp-light-go prev" aria-label="Previous" onClick={(e) => (e.stopPropagation(), setOpen((k) => (k - 1 + frames.length) % frames.length))}>
            ←
          </button>
          <button type="button" className="fp-light-go next" aria-label="Next" onClick={(e) => (e.stopPropagation(), setOpen((k) => (k + 1) % frames.length))}>
            →
          </button>
        </div>,
          document.body,
        )}
    </>
  );
}

type Video = { id: string; title: string; date: string; url: string; image: string };

// The latest uploads from YouTube, from the channel's public feed.
export function YouTubeFeed() {
  const site = useSite();
  const [videos, setVideos] = useState<Video[] | null>(null);
  useEffect(() => {
    fetch("/api/youtube")
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((b: { configured: boolean; videos?: Video[] }) => setVideos(b.configured ? (b.videos ?? []) : []))
      .catch(() => setVideos([]));
  }, []);
  const live = !!videos?.length;
  return (
    <div className="fp-feed">
      <div className="fp-tube">
        {live
          ? videos!.slice(0, 3).map((v) => (
              <a key={v.id} href={v.url} target="_blank" rel="noreferrer" className="fp-video glass">
                <span className="fp-cover">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <Pic src={v.image} alt="" upTo={480} sizes="(max-width: 640px) 100vw, 33vw" />
                  <span className="fp-play" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5l11 7-11 7z" />
                    </svg>
                  </span>
                </span>
                <b>{v.title}</b>
                <span className="mono">{longDate(v.date)}</span>
              </a>
            ))
          : null}
      </div>
      {videos && !live && <Empty title="No videos yet">Films and edits will show here when I upload them.</Empty>}
      <div className="fp-feed-foot">
        <span>{live ? "My latest uploads." : ""}</span>
        {site.social.youtube && (
          <a className="btn btn-glass glass small" href={site.social.youtube} target="_blank" rel="noreferrer">
            Subscribe on YouTube
          </a>
        )}
      </div>
    </div>
  );
}
