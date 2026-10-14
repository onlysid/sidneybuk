"use client";

import { useEffect, useRef, useState } from "react";
import { decodeAudio, feedMeter, onSound, wantSound } from "@/lib/audio";

// The site's own player for a recording.
const RATE = 8000; // samples a second kept for drawing: plenty for a picture, and small
const BANDS = 28;
const FFT = 512;
let playingNow: HTMLAudioElement | null = null; // one recording at a time

const clock = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");
// A stand-in shape for a clip that has not been read yet: the same for the same file, every time.
function guess(src: string, n: number) {
  let seed = 0;
  for (let k = 0; k < src.length; k += Math.max(1, Math.floor(src.length / 64))) seed = (seed * 31 + src.charCodeAt(k)) >>> 0;
  return Array.from({ length: n }, (_, k) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return 0.25 + 0.3 * Math.sin((k / n) * Math.PI) + (seed / 4294967296) * 0.3;
  });
}
// How loud each pitch band is in a short slice of sound (a small Fourier transform, done by hand).
const re = new Float32Array(FFT), im = new Float32Array(FFT);
function spectrum(pcm: Int16Array, from: number, out: Float32Array) {
  for (let n = 0; n < FFT; n++) {
    const v = pcm[from + n] ?? 0;
    re[n] = (v / 32768) * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (FFT - 1)));
    im[n] = 0;
  }
  for (let i = 1, j = 0; i < FFT; i++) {
    let bit = FFT >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j], re[i]];
  }
  for (let len = 2; len <= FFT; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < FFT; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(ang * k), s = Math.sin(ang * k);
        const a = i + k, b = a + len / 2;
        const xr = re[b] * c - im[b] * s, xi = re[b] * s + im[b] * c;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
  // Bands spaced the way hearing is: evenly in pitch, from about 70 Hz to 3.6 kHz.
  for (let b = 0; b < BANDS; b++) {
    const lo = Math.floor(4.5 * 1.155 ** b), hi = Math.max(lo + 1, Math.floor(4.5 * 1.155 ** (b + 1)));
    let sum = 0;
    for (let k = lo; k < hi && k < FFT / 2; k++) sum += Math.hypot(re[k], im[k]);
    out[b] = Math.min(1, Math.sqrt(sum / (hi - lo)) * 0.55 * (1 + b / BANDS));
  }
}

export function Player({ src, title }: { src: string; title: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const wave = useRef<HTMLCanvasElement>(null);
  const ring = useRef<HTMLCanvasElement>(null);
  const data = useRef<{ pcm: Int16Array | null; peaks: number[]; asked: boolean; drag: boolean; hover: number | null; bands: Float32Array; level: number; grow: number }>({ pcm: null, peaks: [], asked: false, drag: false, hover: null, bands: new Float32Array(BANDS), level: 0, grow: 0 });
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);
  const [broken, setBroken] = useState(false);

  // Read the file once, to draw it: every sample averaged down to one quiet channel, and its loud points found.
  const read = () => {
    const d = data.current;
    if (d.asked) return;
    d.asked = true;
    fetch(src)
      .then((r) => r.arrayBuffer())
      .then(decodeAudio)
      .then((buf) => {
        if (buf.duration > 25 * 60) return; // too long to hold in memory for a picture; the plain bar still works
        const step = Math.max(1, Math.round(buf.sampleRate / RATE));
        const chans = Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, c) => buf.getChannelData(c));
        const pcm = new Int16Array(Math.floor(buf.length / step));
        for (let n = 0; n < pcm.length; n++) {
          let sum = 0;
          for (let k = 0; k < step; k++) for (const ch of chans) sum += ch[n * step + k];
          pcm[n] = Math.max(-1, Math.min(1, sum / (step * chans.length))) * 32767;
        }
        const count = 240, size = Math.max(1, Math.floor(pcm.length / count));
        const peaks = Array.from({ length: count }, (_, b) => {
          let top = 0;
          for (let n = b * size; n < (b + 1) * size && n < pcm.length; n += 2) top = Math.max(top, Math.abs(pcm[n]));
          return top / 32768;
        });
        const most = Math.max(0.05, ...peaks);
        d.peaks = peaks.map((v) => v / most);
        d.pcm = pcm;
        d.grow = 0;
        setLength((was) => was || buf.duration);
      })
      .catch(() => {});
  };

  useEffect(() => {
    const el = audio.current!, d = data.current;
    let frame = 0, seen = false, last = performance.now(), shown = -1;
    const stand = guess(src, 240);
    const paint = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const css = getComputedStyle(el.parentElement!);
      const accent = css.getPropertyValue("--accent").trim(), text = css.getPropertyValue("--text").trim();
      const on = !el.paused && !el.ended;
      const total = Number.isFinite(el.duration) && el.duration ? el.duration : 0, at = el.currentTime;
      if (Math.floor(at * 4) !== shown) (shown = Math.floor(at * 4)), setTime(at);
      // What is sounding right now.
      if (d.pcm && on) spectrum(d.pcm, Math.max(0, Math.floor(at * RATE) - FFT / 2), re2);
      // Until the file has been read (or if it cannot be), a gentle swell stands in, so there is still movement.
      else if (on) for (let b = 0; b < BANDS; b++) re2[b] = (0.3 + 0.22 * Math.sin(now / 230 + b * 0.55) + 0.16 * Math.sin(now / 97 + b * 1.7)) * (1 - (b / BANDS) * 0.6);
      else re2.fill(0);
      let level = 0;
      for (let b = 0; b < BANDS; b++) {
        d.bands[b] += (re2[b] - d.bands[b]) * Math.min(1, dt * (re2[b] > d.bands[b] ? 30 : 7));
        level += d.bands[b] / BANDS;
      }
      d.level = level;
      d.grow = Math.min(1, d.grow + dt * 1.6);

      if (on) feedMeter(d.bands); // so the frame of the window can move with a recording too
      for (let b = 0; b < BANDS; b++) echo[b] += (d.bands[b] - echo[b]) * Math.min(1, dt * 2.4);
      const done = total ? at / total : 0;
      head += (done - head) * Math.min(1, dt * (d.drag ? 40 : 16)); // the playhead glides to where it is sent
      spin += dt * (on ? 0.35 : 0.08);

      // The whole clip, as bars above their own reflection.
      const c = wave.current, g = c?.getContext("2d");
      if (c && g) {
        const dpr = Math.min(2, window.devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight;
        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) (c.width = Math.round(w * dpr)), (c.height = Math.round(h * dpr));
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, h);
        const n = Math.max(12, Math.floor(w / 5)), bar = w / n, base = h * 0.66, real = d.peaks.length > 0;
        const lit = g.createLinearGradient(0, 0, w * Math.max(0.02, head), 0);
        lit.addColorStop(0, css.getPropertyValue("--mauve").trim() || accent);
        lit.addColorStop(1, accent);
        for (let k = 0; k < n; k++) {
          const from = Math.floor((k / n) * 240), x = (k + 0.5) / n;
          const v = real ? stand[from] + (d.peaks[from] - stand[from]) * d.grow : stand[from] * 0.6;
          const back = (head - x) * n; // how many bars behind the playhead
          const ripple = on && back >= 0 ? level * 1.5 * Math.exp(-back / 14) * (0.5 + 0.5 * Math.sin(back * 0.75 - now / 85)) : 0;
          const tall = Math.max(2, (0.08 + v * 0.86) * base * (1 + ripple));
          const played = x <= head, ghost = d.hover !== null && x <= d.hover && !played;
          g.fillStyle = played ? lit : ghost ? accent : text;
          g.globalAlpha = played ? 1 : ghost ? 0.5 : real ? 0.3 : 0.16;
          g.beginPath();
          g.roundRect(k * bar + bar * 0.22, base - Math.min(base, tall), bar * 0.56, Math.min(base, tall), bar * 0.28);
          g.fill();
          g.globalAlpha *= 0.32; // the reflection
          g.beginPath();
          g.roundRect(k * bar + bar * 0.22, base + 2, bar * 0.56, Math.min(h - base - 2, tall * 0.42), bar * 0.28);
          g.fill();
        }
        g.globalAlpha = 1;
        // The playhead, and the time under the pointer when it is hovering or dragging.
        if (total) {
          const x = Math.max(1.5, Math.min(w - 1.5, head * w));
          g.fillStyle = accent;
          g.shadowColor = accent;
          g.shadowBlur = on ? 6 + level * 22 : 4;
          g.beginPath();
          g.roundRect(x - 1, 0, 2, h, 1);
          g.fill();
          g.beginPath();
          g.arc(x, base, 4 + (on ? level * 4 : 0), 0, 7);
          g.fill();
          g.shadowBlur = 0;
          const tip = d.drag ? head : d.hover;
          if (tip !== null) {
            const label = clock(tip * total);
            g.font = "600 11px ui-monospace, monospace";
            const tw = g.measureText(label).width + 12, tx = Math.max(0, Math.min(w - tw, tip * w - tw / 2));
            g.fillStyle = text;
            g.beginPath();
            g.roundRect(tx, 0, tw, 18, 9);
            g.fill();
            g.fillStyle = css.getPropertyValue("--bg").trim() || "#fff";
            g.textBaseline = "middle";
            g.fillText(label, tx + 6, 9.5);
          }
        }
      }
      // Round the button: a soft shape that swells where the sound is (low notes at the top, running round both ways), slowly turning, with a larger,…
      const r = ring.current, q = r?.getContext("2d");
      if (r && q) {
        const dpr = Math.min(2, window.devicePixelRatio || 1), s = r.clientWidth;
        if (r.width !== Math.round(s * dpr)) r.width = r.height = Math.round(s * dpr);
        q.setTransform(dpr, 0, 0, dpr, 0, 0);
        q.clearRect(0, 0, s, s);
        const inner = s * 0.3, room = s * 0.19, breathe = on ? 0 : 0.05 + 0.04 * Math.sin(now / 800);
        const blob = (from: Float32Array, scale: number, turn: number) => {
          const count = 72, pts: [number, number][] = [];
          for (let k = 0; k < count; k++) {
            const part = (k / count) * BANDS * 2;
            const b = part < BANDS ? part : BANDS * 2 - part, lo = Math.min(BANDS - 1, Math.floor(b)), hi = Math.min(BANDS - 1, lo + 1);
            // Each point also leans on its neighbours, so the outline is a soft swell rather than a row of teeth.
            const v = Math.max(breathe, (from[Math.max(0, lo - 1)] + 2 * (from[lo] + (from[hi] - from[lo]) * (b - lo)) + from[Math.min(BANDS - 1, hi + 1)]) / 4);
            const a = -Math.PI / 2 + turn + (k / count) * Math.PI * 2, rad = inner + 2 + v * room * scale;
            pts.push([s / 2 + Math.cos(a) * rad, s / 2 + Math.sin(a) * rad]);
          }
          q.beginPath();
          q.moveTo((pts[0][0] + pts[count - 1][0]) / 2, (pts[0][1] + pts[count - 1][1]) / 2);
          for (let k = 0; k < count; k++) {
            const next = pts[(k + 1) % count];
            q.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + next[0]) / 2, (pts[k][1] + next[1]) / 2);
          }
          q.closePath();
        };
        q.fillStyle = accent;
        q.globalAlpha = 0.14;
        blob(echo, 1.35, -spin * 0.6);
        q.fill();
        const fill = q.createRadialGradient(s / 2, s / 2, inner * 0.8, s / 2, s / 2, inner + room);
        fill.addColorStop(0, css.getPropertyValue("--rose").trim() || accent);
        fill.addColorStop(1, accent);
        q.fillStyle = fill;
        q.globalAlpha = 0.5 + Math.min(0.4, level * 1.6);
        blob(d.bands, 1, spin);
        q.fill();
        q.globalAlpha = 0.9;
        q.strokeStyle = accent;
        q.lineWidth = 1.5;
        q.stroke();
        q.globalAlpha = 1;
      }
      if (seen && (on || d.grow < 1 || d.level > 0.004 || d.hover !== null || d.drag || Math.abs(done - head) > 0.001)) frame = requestAnimationFrame(paint);
      else frame = 0;
    };
    const re2 = new Float32Array(BANDS), echo = new Float32Array(BANDS);
    let head = 0, spin = 0;
    const wake = () => {
      if (!frame && seen) (last = performance.now()), (frame = requestAnimationFrame(paint));
    };
    data.current = Object.assign(d, { wake });
    const io = new IntersectionObserver(([e]) => ((seen = e.isIntersecting), wake()));
    io.observe(el.parentElement!);
    const onPlay = () => {
      if (playingNow && playingNow !== el) playingNow.pause();
      playingNow = el;
      setPlaying(true);
      wake();
    };
    const onPause = () => (setPlaying(false), wake());
    const onMeta = () => Number.isFinite(el.duration) && setLength(el.duration);
    const onError = () => setBroken(true);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onPause);
    el.addEventListener("seeked", wake);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("error", onError);
    window.addEventListener("resize", wake);
    const offSound = onSound((on) => !on && el.pause()); // sound switched off in the menu pauses a recording
    return () => {
      offSound();
      io.disconnect();
      cancelAnimationFrame(frame);
      el.pause();
      if (playingNow === el) playingNow = null;
      for (const [name, fn] of [["play", onPlay], ["pause", onPause], ["ended", onPause], ["seeked", wake], ["loadedmetadata", onMeta], ["durationchange", onMeta], ["error", onError]] as const) el.removeEventListener(name, fn);
      window.removeEventListener("resize", wake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const wake = () => (data.current as unknown as { wake?: () => void }).wake?.();
  const toggle = () => {
    const el = audio.current!;
    read();
    if (el.paused) wantSound(); // pressing play is asking for sound
    if (el.paused) void el.play().catch(() => setBroken(true));
    else el.pause();
  };
  const place = (e: React.PointerEvent) => {
    const box = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
  };
  const jump = (part: number) => {
    const el = audio.current!, total = el.duration || length;
    if (total) el.currentTime = part * total;
    setTime(el.currentTime);
    wake();
  };
  const total = length || 0;

  return (
    <div className="pl" data-playing={playing} data-broken={broken}>
      <audio ref={audio} src={src} preload="metadata" data-title={title} />
      <div className="pl-disc">
        <canvas ref={ring} aria-hidden="true" />
        <button type="button" className="pl-play" onClick={toggle} aria-label={playing ? `Pause ${title}` : `Play ${title}`}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {playing ? <path d="M7 5h3.500v14H7zM13.500 5H17v14h-3.500z" /> : <path d="M8.500 5.200v13.600L19 12z" />}
          </svg>
        </button>
      </div>
      <div className="pl-main">
        <canvas
          ref={wave}
          className="pl-wave"
          role="slider"
          tabIndex={0}
          aria-label={`Position in ${title}`}
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${clock(time)} of ${clock(total)}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            data.current.drag = true;
            read();
            jump(place(e));
          }}
          onPointerMove={(e) => {
            if (data.current.drag) jump(place(e));
            else if (e.pointerType === "mouse") (data.current.hover = place(e)), wake();
          }}
          onPointerUp={() => (data.current.drag = false)}
          onPointerCancel={() => (data.current.drag = false)}
          onPointerLeave={() => ((data.current.hover = null), wake())}
          onKeyDown={(e) => {
            const step = e.key === "ArrowRight" ? 5 : e.key === "ArrowLeft" ? -5 : 0;
            if (step && total) (e.preventDefault(), jump(Math.max(0, Math.min(1, (time + step) / total))));
            if (e.key === " " || e.key === "Enter") (e.preventDefault(), toggle());
          }}
        />
        <div className="pl-foot mono">
          <span>{broken ? "This recording could not be played" : clock(time)}</span>
          <span>{total ? clock(total) : ""}</span>
        </div>
      </div>
    </div>
  );
}
