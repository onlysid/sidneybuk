"use client";

import { useEffect, useRef, useState } from "react";
import { note, soundOn } from "@/lib/audio";

// A padel court is 10 by 20 metres with the net across the middle and glass all round.
const W = 10;
const L = 20;
const NET = 10;
const G = 15; // gravity, tuned for feel
const REACH = 1.3;
const POINTS = ["0", "15", "30", "40"];
const GAMES_TO_WIN = 3;

type Side = "you" | "cpu";
const other = (s: Side): Side => (s === "you" ? "cpu" : "you");
const sideOf = (y: number): Side => (y < NET ? "cpu" : "you");
const rand = (a: number, b: number) => a + Math.random() * (b - a);

type State = {
  ball: { x: number; y: number; z: number; vx: number; vy: number; vz: number };
  trail: [number, number, number][];
  pos: Record<Side, { x: number; y: number }>;
  swing: Record<Side, number>; // seconds since each player last swung
  lastHit: Side;
  bounces: number; // floor bounces since the last hit
  points: Record<Side, number>;
  games: Record<Side, number>;
  server: Side;
  phase: "serve" | "play" | "point" | "over";
  wait: number;
  rally: number;
  longest: number;
  note: string;
  flash: { x: number; y: number; t: number } | null;
  sparks: { x: number; y: number; vx: number; vy: number; t: number }[];
  aimNoise: number;
};
const fresh = (): State => ({
  ball: { x: 5, y: 18, z: 1, vx: 0, vy: 0, vz: 0 },
  trail: [],
  pos: { you: { x: 5, y: 17 }, cpu: { x: 5, y: 3 } },
  swing: { you: 9, cpu: 9 },
  lastHit: "cpu",
  bounces: 0,
  points: { you: 0, cpu: 0 },
  games: { you: 0, cpu: 0 },
  server: "you",
  phase: "serve",
  wait: 1,
  rally: 0,
  longest: 0,
  note: "First to three games. Golden point at 40–40.",
  flash: null,
  sparks: [],
  aimNoise: 0,
});

// Padel, from above, with the real rules that make it padel: the ball must bounce once on the receiving side, after that it may come off the glass, and you…
export function PadelGame({ onQuit }: { onQuit: (summary: string) => void }) {
  const game = useRef<State>(fresh());
  const canvas = useRef<HTMLCanvasElement>(null);
  const keys = useRef({ left: false, right: false, up: false, down: false });
  const target = useRef<{ x: number; y: number } | null>(null);
  const [hud, setHud] = useState({ you: 0, cpu: 0, gy: 0, gc: 0, note: game.current.note, over: false, rally: 0 });
  const [best, setBest] = useState(0);
  const quit = useRef(onQuit);
  quit.current = onQuit;

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("padel-best")) || 0);
    } catch {
      // No storage: the best rally just lasts for this visit.
    }
  }, []);
  const leave = () => {
    const s = game.current;
    quit.current(`padel: you ${s.games.you}–${s.games.cpu} cpu. Longest rally ${s.longest}.`);
  };
  const again = () => {
    const longest = game.current.longest;
    Object.assign(game.current, fresh(), { longest });
  };

  useEffect(() => {
    const node = canvas.current;
    const context = node?.getContext("2d");
    if (!node || !context) return;
    const el: HTMLCanvasElement = node;
    const g: CanvasRenderingContext2D = context;
    const s = game.current;
    let frame = 0;
    let last = performance.now();
    let shown = "";
    const blip = (f: number) => soundOn() && note(f, { instrument: "pure", gain: 0.12, length: 0.12 });

    const award = (to: Side, why: string) => {
      s.longest = Math.max(s.longest, s.rally);
      s.points[to] += 1;
      s.note = why;
      if (s.points[to] > 3) {
        s.games[to] += 1;
        s.points = { you: 0, cpu: 0 };
        s.server = other(s.server);
        s.note = `${why} Game to ${to === "you" ? "you" : "the computer"}.`;
      }
      s.phase = s.games[to] >= GAMES_TO_WIN ? "over" : "point";
      s.wait = 1.3;
      if (s.phase === "over") s.note = to === "you" ? "You win the match." : "The computer takes the match.";
      blip(to === "you" ? 660 : 220);
    };

    // Send the ball from where it is to land at a chosen spot on the other side.
    const hit = (who: Side, serve = false) => {
      const b = s.ball;
      const me = s.pos[who];
      const atNet = Math.abs(me.y - NET) < 3.6 && b.z > 0.9 && !serve;
      const far = who === "you" ? 1 : -1; // which way "back" is on the other side
      const offset = b.x - me.x;
      let tx = Math.max(1, Math.min(W - 1, W / 2 + offset * 4.2 + (b.x - W / 2) * 0.35 + (who === "cpu" ? rand(-2.6, 2.6) : rand(-0.5, 0.5))));
      if (serve) tx = rand(2, 8);
      const ty = NET - far * (atNet ? rand(5, 8) : rand(3, 7.5));
      let T = atNet ? 0.62 : serve ? 1.25 : rand(0.95, 1.3);
      for (let n = 0; n < 6; n++) {
        b.vx = (tx - b.x) / T;
        b.vy = (ty - b.y) / T;
        b.vz = (0.5 * G * T * T - b.z) / T;
        const tNet = (NET - b.y) / b.vy;
        if (b.z + b.vz * tNet - 0.5 * G * tNet * tNet > 1.15) break;
        T += 0.14; // too flat to clear the net: lift it
      }
      s.lastHit = who;
      s.bounces = 0;
      s.swing[who] = 0;
      s.rally += serve ? 0 : 1;
      s.aimNoise = rand(-0.7, 0.7);
      s.note = atNet ? (who === "you" ? "Smash!" : "It smashes.") : s.points.you === 3 && s.points.cpu === 3 ? "Golden point." : "";
      for (let n = 0; n < 7; n++) s.sparks.push({ x: b.x, y: b.y, vx: rand(-3, 3), vy: rand(-3, 3), t: 0 });
      blip(atNet ? 520 : who === "you" ? 392 : 330);
    };

    // Where the ball will be shortly after its first bounce: where a player wants to stand.
    const predict = () => {
      const b = { ...s.ball };
      let bounced = s.bounces;
      for (let n = 0; n < 240; n++) {
        const dt = 1 / 60;
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vz -= G * dt;
        if (b.x < 0.2 || b.x > W - 0.2) b.vx *= -0.75;
        if (b.y < 0.2 || b.y > L - 0.2) b.vy *= -0.75;
        if (b.z <= 0 && b.vz < 0) {
          b.z = 0; b.vz *= -0.72; b.vx *= 0.82; b.vy *= 0.82;
          bounced += 1;
        }
        if (bounced >= 1 && b.vz < 0 && b.z < 1.2) break;
      }
      return b;
    };

    const step = (dt: number) => {
      const b = s.ball;
      s.swing.you += dt;
      s.swing.cpu += dt;
      // You: towards the pointer if there is one, otherwise by the keys.
      const me = s.pos.you;
      const k = keys.current;
      if (k.left || k.right || k.up || k.down) {
        target.current = null;
        me.x += ((k.right ? 1 : 0) - (k.left ? 1 : 0)) * 8.5 * dt;
        me.y += ((k.down ? 1 : 0) - (k.up ? 1 : 0)) * 8.5 * dt;
      } else if (target.current) {
        const dx = target.current.x - me.x, dy = target.current.y - me.y;
        const d = Math.hypot(dx, dy);
        const move = Math.min(d, 12 * dt);
        if (d > 0.01) { me.x += (dx / d) * move; me.y += (dy / d) * move; }
      }
      me.x = Math.max(0.6, Math.min(W - 0.6, me.x));
      me.y = Math.max(NET + 0.9, Math.min(L - 0.6, me.y));
      // The computer: to where the ball is going when it is its turn, otherwise back to the middle.
      const it = s.pos.cpu;
      let want = { x: W / 2, y: 3.6 };
      if (s.phase === "play" && s.lastHit === "you") {
        const p = predict();
        if (p.y < NET) want = { x: p.x + s.aimNoise, y: Math.min(NET - 1, p.y + 0.3) };
      }
      const cdx = want.x - it.x, cdy = want.y - it.y;
      const cd = Math.hypot(cdx, cdy);
      const cmove = Math.min(cd, 5.4 * dt);
      if (cd > 0.01) { it.x += (cdx / cd) * cmove; it.y += (cdy / cd) * cmove; }
      it.x = Math.max(0.6, Math.min(W - 0.6, it.x));
      it.y = Math.max(0.6, Math.min(NET - 0.9, it.y));

      s.sparks = s.sparks.filter((p) => (p.t += dt) < 0.4);
      s.sparks.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; });
      if (s.flash && (s.flash.t += dt) > 0.45) s.flash = null;

      if (s.phase === "over") return;
      if (s.phase !== "play") {
        s.wait -= dt;
        const from = s.pos[s.server];
        if (s.phase === "point" && s.wait <= 0) {
          s.phase = "serve";
          s.wait = 0.9;
        }
        if (s.phase === "serve") {
          b.x = from.x + 0.5; b.y = from.y + (s.server === "you" ? -0.4 : 0.4); b.z = 1.1;
          b.vx = b.vy = b.vz = 0;
          s.trail = [];
          if (s.wait <= 0) {
            s.rally = 0;
            s.phase = "play";
            hit(s.server, true);
          }
        }
        return;
      }

      const wasSide = sideOf(b.y);
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vz -= G * dt;
      s.trail.push([b.x, b.y, b.z]);
      if (s.trail.length > 9) s.trail.shift();
      const receiver = other(s.lastHit);

      // Back over the net untouched after bouncing: the hitter's point.
      if (s.bounces >= 1 && wasSide === receiver && sideOf(b.y) === s.lastHit) return award(s.lastHit, s.lastHit === "you" ? "Off the glass and back over. Yours!" : "It comes back over the net.");
      // Glass.
      const wall = b.x < 0.15 || b.x > W - 0.15 || b.y < 0.15 || b.y > L - 0.15;
      if (wall) {
        s.flash = { x: Math.max(0, Math.min(W, b.x)), y: Math.max(0, Math.min(L, b.y)), t: 0 };
        if (b.x < 0.15) { b.x = 0.15; b.vx = Math.abs(b.vx) * 0.75; }
        if (b.x > W - 0.15) { b.x = W - 0.15; b.vx = -Math.abs(b.vx) * 0.75; }
        if (b.y < 0.15) { b.y = 0.15; b.vy = Math.abs(b.vy) * 0.75; }
        if (b.y > L - 0.15) { b.y = L - 0.15; b.vy = -Math.abs(b.vy) * 0.75; }
        blip(180);
        if (s.bounces === 0) return award(receiver, receiver === "you" ? "Long: it hit the glass first." : "Out. That one hit the glass first.");
        if (receiver === "you") s.note = "Off the glass: play it!";
      }
      // Floor.
      if (b.z <= 0 && b.vz < 0) {
        b.z = 0; b.vz *= -0.72; b.vx *= 0.82; b.vy *= 0.82;
        s.bounces += 1;
        if (sideOf(b.y) === s.lastHit) return award(receiver, "Into its own half.");
        if (s.bounces >= 2) return award(s.lastHit, s.lastHit === "you" ? "Winner!" : "Two bounces. Its point.");
      }
      // A swing, whenever the ball is in reach of the player whose turn it is.
      const p = s.pos[receiver];
      if (sideOf(b.y) === receiver && b.z < 2.7 && Math.hypot(b.x - p.x, b.y - p.y) < REACH) hit(receiver);
    };

    // ---- drawing ----
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = el.clientWidth, ch = el.clientHeight;
      if (el.width !== Math.round(cw * dpr)) { el.width = Math.round(cw * dpr); el.height = Math.round(ch * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, cw, ch);
      const pad = 14;
      const sx = (cw - pad * 2) / W, sy = (ch - pad * 2) / L;
      const X = (x: number) => pad + x * sx, Y = (y: number) => pad + y * sy;
      const lift = sy * 0.55; // how far up the screen a metre of height moves the ball

      // Floor.
      const floor = g.createLinearGradient(0, Y(0), 0, Y(L));
      floor.addColorStop(0, "#3f2d57");
      floor.addColorStop(0.5, "#5a3f78");
      floor.addColorStop(1, "#6b4a8a");
      g.fillStyle = floor;
      g.beginPath();
      g.roundRect(X(0), Y(0), W * sx, L * sy, 8);
      g.fill();
      // Lines.
      g.strokeStyle = "rgba(255,255,255,0.55)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(X(0), Y(NET - 6.95)); g.lineTo(X(W), Y(NET - 6.95));
      g.moveTo(X(0), Y(NET + 6.95)); g.lineTo(X(W), Y(NET + 6.95));
      g.moveTo(X(W / 2), Y(NET - 6.95)); g.lineTo(X(W / 2), Y(NET + 6.95));
      g.stroke();
      // Glass: a bright edge with a faint second pane outside it.
      g.strokeStyle = "rgba(255,255,255,0.85)";
      g.lineWidth = 2;
      g.beginPath(); g.roundRect(X(0), Y(0), W * sx, L * sy, 8); g.stroke();
      g.strokeStyle = "rgba(221,179,203,0.35)";
      g.lineWidth = 1;
      g.beginPath(); g.roundRect(X(0) - 5, Y(0) - 5, W * sx + 10, L * sy + 10, 12); g.stroke();
      if (s.flash) {
        const a = 1 - s.flash.t / 0.45;
        g.strokeStyle = `rgba(233,255,112,${a})`;
        g.lineWidth = 2;
        g.beginPath(); g.arc(X(s.flash.x), Y(s.flash.y), 6 + s.flash.t * 60, 0, 7); g.stroke();
      }
      // Net.
      g.fillStyle = "rgba(11,8,16,0.35)";
      g.fillRect(X(0), Y(NET) + 2, W * sx, 5);
      g.strokeStyle = "#fff";
      g.lineWidth = 2.5;
      g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(X(0) - 4, Y(NET)); g.lineTo(X(W) + 4, Y(NET)); g.stroke();
      g.setLineDash([]);

      // Players: a body, and a round bat that swings through when they hit.
      const player = (who: Side, colour: string) => {
        const p = s.pos[who];
        const dir = who === "you" ? -1 : 1;
        const sw = Math.max(0, 1 - s.swing[who] / 0.22);
        g.fillStyle = "rgba(11,8,16,0.3)";
        g.beginPath(); g.ellipse(X(p.x) + 2, Y(p.y) + 4, sx * 0.5, sy * 0.38, 0, 0, 7); g.fill();
        g.save();
        g.translate(X(p.x), Y(p.y));
        g.rotate(dir * (0.9 - sw * 2.4));
        g.strokeStyle = "#fff";
        g.lineWidth = 3;
        g.lineCap = "round";
        g.beginPath(); g.moveTo(sx * 0.3, 0); g.lineTo(sx * 0.75, 0); g.stroke();
        g.fillStyle = "#fff";
        g.beginPath(); g.ellipse(sx * 1.08, 0, sx * 0.4, sx * 0.34, 0, 0, 7); g.fill();
        g.fillStyle = "#684780";
        for (const [hx, hy] of [[1.0, 0], [1.18, -0.12], [1.18, 0.12], [0.92, -0.14], [0.92, 0.14]]) { g.beginPath(); g.arc(sx * hx, sx * hy, 1.4, 0, 7); g.fill(); }
        g.restore();
        g.fillStyle = colour;
        g.strokeStyle = "#fff";
        g.lineWidth = 2;
        g.beginPath(); g.arc(X(p.x), Y(p.y), sx * 0.42, 0, 7); g.fill(); g.stroke();
      };
      player("cpu", "#a878aa");

      // Ball: its shadow stays on the floor, the ball itself rises up the screen and grows with height.
      const b = s.ball;
      s.trail.forEach(([tx, ty, tz], n) => {
        g.fillStyle = `rgba(233,255,112,${(n / s.trail.length) * 0.35})`;
        g.beginPath(); g.arc(X(tx), Y(ty) - tz * lift, 2 + tz * 0.6, 0, 7); g.fill();
      });
      g.fillStyle = `rgba(11,8,16,${0.45 - Math.min(0.3, b.z * 0.06)})`;
      g.beginPath(); g.ellipse(X(b.x), Y(b.y), 5 + b.z * 1.2, 3 + b.z * 0.7, 0, 0, 7); g.fill();
      g.fillStyle = "#e9ff70";
      g.shadowColor = "#e9ff70";
      g.shadowBlur = 10;
      g.beginPath(); g.arc(X(b.x), Y(b.y) - b.z * lift, 4.5 + b.z * 1.1, 0, 7); g.fill();
      g.shadowBlur = 0;
      s.sparks.forEach((p) => {
        g.fillStyle = `rgba(255,255,255,${1 - p.t / 0.4})`;
        g.beginPath(); g.arc(X(p.x), Y(p.y), 1.8, 0, 7); g.fill();
      });
      player("you", "#ddb3cb");
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      step(dt / 2);
      step(dt / 2);
      draw();
      // Only tell React when something on the scoreboard has changed.
      const key = `${s.points.you}${s.points.cpu}${s.games.you}${s.games.cpu}${s.note}${s.phase}${s.rally}`;
      if (key !== shown) {
        shown = key;
        setHud({ you: s.points.you, cpu: s.points.cpu, gy: s.games.you, gc: s.games.cpu, note: s.note, over: s.phase === "over", rally: s.rally });
      }
    };
    frame = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const down = e.type === "keydown";
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") keys.current.left = down;
      else if (k === "arrowright" || k === "d") keys.current.right = down;
      else if (k === "arrowup" || k === "w") keys.current.up = down;
      else if (k === "arrowdown" || k === "s") keys.current.down = down;
      else if (down && k === "q") leave();
      else if (down && k === "enter" && s.phase === "over") again();
      else return;
      e.preventDefault();
    };
    // The pointer says where you want to stand; you run there.
    const aim = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const pad = 14;
      target.current = { x: ((e.clientX - box.left - pad) / (box.width - pad * 2)) * W, y: ((e.clientY - box.top - pad) / (box.height - pad * 2)) * L - (e.pointerType === "touch" ? 1.6 : 0) };
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    el.addEventListener("pointermove", aim);
    el.addEventListener("pointerdown", aim);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      el.removeEventListener("pointermove", aim);
      el.removeEventListener("pointerdown", aim);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const longest = game.current.longest;
  useEffect(() => {
    if (longest <= best) return;
    setBest(longest);
    try {
      localStorage.setItem("padel-best", String(longest));
    } catch {
      // Fine without storage.
    }
  }, [longest, best]);

  const golden = hud.you === 3 && hud.cpu === 3;
  return (
    <div className="padel" data-keys>
      <div className="pd-score">
        <span>
          you <b key={hud.you}>{POINTS[hud.you]}</b>
        </span>
        <span className="pd-games">{golden ? "golden point" : `games ${hud.gy}–${hud.gc}`}</span>
        <span>
          <b key={hud.cpu}>{POINTS[hud.cpu]}</b> cpu
        </span>
      </div>
      <canvas ref={canvas} className="pd-court" role="img" aria-label={`Padel. You ${POINTS[hud.you]}, computer ${POINTS[hud.cpu]}. Games ${hud.gy} to ${hud.gc}.`} />
      <div className="pd-note" aria-live="polite">
        <span key={hud.note}>{hud.note || `rally ${hud.rally}${best ? ` · best ${Math.max(best, longest)}` : ""}`}</span>
      </div>
      <div className="pd-pad">
        <span className="pd-hint">Move with your finger, the mouse or the arrow keys. Get close to the net to smash.</span>
        {hud.over && (
          <button type="button" onClick={again}>
            Play again
          </button>
        )}
        <button type="button" onClick={leave}>
          Quit
        </button>
      </div>
    </div>
  );
}
