"use client";

import { Pill } from "@/components/Pill";
import { useEffect, useRef, useState } from "react";
import { Eq, fn, frac, i, n, o, row, sub, sup, useCanvas } from "./mathkit";

// Photography, one idea at a time. Each piece is a small working model with the equation behind it.
const STOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
const mm = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1));
const gap = `<mspace width="1.2em"/>`;

// A number that glides to its new value instead of jumping, so a control moves the picture the way a real ring or lever would: the iris closes, the…
function useGlide(target: number, rate = 9) {
  const [value, setValue] = useState(target);
  const now = useRef(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      now.current = target;
      setValue(target);
      return;
    }
    let frame = 0, last = performance.now();
    const tick = (time: number) => {
      const dt = Math.min(0.05, (time - last) / 1000);
      last = time;
      now.current += (target - now.current) * (1 - Math.exp(-rate * dt));
      if (Math.abs(target - now.current) < Math.max(0.002, Math.abs(target) * 0.001)) {
        now.current = target;
        setValue(target);
        return;
      }
      setValue(now.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, rate]);
  return value;
}
// The same idea inside a canvas loop: move `from` a fraction of the way to `to` each frame.
const ease = (from: number, to: number, dt: number, rate = 8) => from + (to - from) * (1 - Math.exp(-rate * dt));

function Card({ flip = false, kicker, title, children, pic, controls }: { flip?: boolean; kicker: string; title: string; children: React.ReactNode; pic: React.ReactNode; controls?: React.ReactNode }) {
  return (
    <article className={flip ? "wave-card flip ph-card" : "wave-card ph-card"}>
      <div className="wave-pic">
        <div className="ph-stage">
          {pic}
        </div>
        {controls && <div className="lab-row">{controls}</div>}
      </div>
      <div className="wave-text">
        <span className="mono">{kicker}</span>
        <h3>{title}</h3>
        {children}
      </div>
    </article>
  );
}
const Slide = ({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <label className="slider mono">
    {label}
    <input type="range" {...rest} />
  </label>
);

// --------------------------------------------------------------------------------------------- Aperture: the hole.
function Aperture() {
  const [pos, setPos] = useState(2); // where along the row of stops, fractions included while it glides
  const at = Math.round(pos);
  const N = STOPS[at];
  const smooth = 1.4 * Math.SQRT2 ** useGlide(pos, 7); // the iris eases to the new stop
  const R = 86, open = (R * 1.4) / smooth * 0.96, blades = 7;
  const corner = (k: number, r: number, turn = 0) => [r * Math.cos((k / blades) * Math.PI * 2 + turn), r * Math.sin((k / blades) * Math.PI * 2 + turn)];
  const hole = Array.from({ length: blades }, (_, k) => corner(k, open, 0.3).map((v) => v.toFixed(2)).join(",")).join(" ");
  return (
    <Card
      kicker="Aperture and f-stops"
      title="The hole the light comes through"
      pic={
        <svg viewBox="-100 -100 200 200" className="ph-iris" role="img" aria-label={`A lens aperture set to f/${N}`}>
          <circle r="96" className="iris-barrel" />
          <circle r={R} className="iris-glass" />
          <path d={`M${R},0A${R},${R} 0 1 0 ${-R},0A${R},${R} 0 1 0 ${R},0ZM${hole.split(" ").join("L")}Z`} fillRule="evenodd" className="iris-blades" />
          {Array.from({ length: blades }, (_, k) => {
            const [x1, y1] = corner(k, open, 0.3), [x2, y2] = corner(k + 1.35, R, 0.3);
            return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} className="iris-edge" />;
          })}
          <polygon points={hole} className="iris-hole" />
          <polygon points={hole} className="iris-light" style={{ opacity: Math.min(1, 2.6 / smooth) }} />
          <text y="5" textAnchor="middle" className="iris-n">
            f/{N}
          </text>
        </svg>
      }
      controls={
        <>
          <div className="ph-stops" role="group" aria-label="f-stop">
            <Pill />
            {STOPS.map((s, k) => (
              <button key={s} type="button" aria-pressed={k === at} onClick={() => setPos(k)}>
                {s}
              </button>
            ))}
          </div>
        </>
      }
    >
      <p>
        On a 50 mm lens, f/{N} is a hole <strong>{mm(50 / N)} mm</strong> across. Each step along the row is one <em>stop</em>: half the light of the one before. Compared with f/1.4 this lets in <strong>{at === 0 ? "all of it" : `1/${2 ** at}`}</strong>.
      </p>
      <ol className="formulas">
        <Eq math={row(i("N"), o("="), frac(i("f"), i("D")))} label="N equals f over D">
          The f-number is the focal length divided by the width of the hole. Bigger number, smaller hole.
        </Eq>
        <Eq math={row(i("light"), o("∝"), frac(n(1), sup(i("N"), n(2))))} label="Light is proportional to one over N squared">
          Light goes with the hole&rsquo;s area. To halve the area you multiply N by &radic;2, which is why the stops run 1.4, 2, 2.8, 4, 5.6&hellip;
        </Eq>
      </ol>
    </Card>
  );
}

// --------------------------------------------------------------------------------------------- Depth of field and bokeh.
const LIGHTS = Array.from({ length: 34 }, (_, k) => {
  const r = (s: number) => ((Math.sin(k * 12.9898 + s * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { x: r(1), y: 0.12 + r(2) * 0.5, hue: [330, 285, 40, 200][Math.floor(r(3) * 4)], bright: 0.5 + r(4) * 0.5 };
});
function Bokeh() {
  const [at, setAt] = useState(1);
  const [focus, setFocus] = useState(2);
  const [blades, setBlades] = useState(0);
  const live = useRef({ at, focus, blades, t: 0, N: STOPS[at], f: focus });
  live.current.at = at;
  live.current.focus = focus;
  live.current.blades = blades;
  const F = 85, FAR = 14; // an 85 mm lens; the lights are 14 m away, the subject 2 m
  // Width of the blur disc on the sensor, in mm, for something at distance d (m) with the lens focused at s (m).
  const disc = (d: number, s: number, N: number) => ((F * F) / N) * (Math.abs(d - s) * 1000) / (d * 1000 * (s * 1000 - F));
  const ref = useCanvas((g, w, h, dt) => {
    const c = live.current;
    c.t += dt;
    c.N = ease(c.N, STOPS[c.at], dt);
    c.f = ease(c.f, c.focus, dt);
    const N = c.N;
    const px = (v: number) => (v / 36) * w; // sensor mm to pixels, on a 36 mm wide frame
    g.clearRect(0, 0, w, h);
    const night = g.createLinearGradient(0, 0, 0, h);
    night.addColorStop(0, "#0d0916");
    night.addColorStop(1, "#1d1428");
    g.fillStyle = night;
    g.fillRect(0, 0, w, h);
    // The lights behind.
    const far = Math.max(1.2, px(disc(FAR, c.f, N)) / 2);
    g.globalCompositeOperation = "lighter";
    for (const [k, l] of LIGHTS.entries()) {
      const twinkle = 0.72 + 0.28 * Math.sin(c.t * (1.3 + (k % 5) * 0.5) + k * 1.7);
      const alpha = Math.min(0.95, ((l.bright * 26) / (far * far) + 0.1) * twinkle);
      g.fillStyle = `hsla(${l.hue}, 85%, 72%, ${alpha})`;
      g.beginPath();
      if (!c.blades) g.arc(l.x * w, l.y * h, far, 0, 7);
      else for (let k = 0; k < c.blades; k++) g.lineTo(l.x * w + far * Math.cos((k / c.blades) * 6.2832 + 0.4), l.y * h + far * Math.sin((k / c.blades) * 6.2832 + 0.4));
      g.fill();
    }
    g.globalCompositeOperation = "source-over";
    // The subject, 2 m away: drawn many times over inside its own blur disc.
    const near = px(disc(2, c.f, N)) / 2;
    const copies = near < 0.6 ? 1 : 26;
    const cx = w * 0.5, base = h, head = Math.min(w, h) * 0.13;
    for (let k = 0; k < copies; k++) {
      const a = k * 2.399, r = copies === 1 ? 0 : near * Math.sqrt((k + 0.5) / copies);
      const ox = r * Math.cos(a), oy = r * Math.sin(a);
      g.globalAlpha = copies === 1 ? 1 : 0.11;
      g.fillStyle = "#3a2f45";
      g.beginPath();
      g.ellipse(cx + ox, base + oy, head * 2.2, head * 2.5, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = "#ddb3cb";
      g.beginPath();
      g.arc(cx + ox, base - head * 3.1 + oy, head, 0, 7);
      g.fill();
    }
    g.globalAlpha = 1;
  });
  const N = STOPS[at];
  return (
    <Card
      flip
      kicker="Depth of field and bokeh"
      title="Why backgrounds melt"
      pic={<canvas ref={ref} className="sim wave ph-frame" role="img" aria-label={`A figure two metres away in front of distant lights, at f/${N}, focused at ${focus} metres`} />}
      controls={
        <>
          <Slide label={`Aperture f/${N}`} min={0} max={STOPS.length - 1} value={at} onChange={(e) => setAt(Number(e.target.value))} aria-label="Aperture" />
          <Slide label={`Focus ${focus.toFixed(1)} m`} min={1} max={14} step={0.1} value={focus} onChange={(e) => setFocus(Number(e.target.value))} aria-label="Focus distance" />
          <div className="ph-stops" role="group" aria-label="Aperture blades">
            <Pill />
            {[
              [0, "Round"],
              [5, "5 blades"],
              [6, "6"],
              [8, "8"],
            ].map(([v, name]) => (
              <button key={v} type="button" aria-pressed={blades === v} onClick={() => setBlades(v as number)}>
                {name}
              </button>
            ))}
          </div>
        </>
      }
    >
      <p>
        A lens is only truly sharp at one distance. A point anywhere else lands on the sensor as a small disc in the shape of the aperture. Here each distant light is a disc <strong>{disc(FAR, focus, N).toFixed(2)} mm</strong> wide on the sensor. Open the aperture and they swell into bokeh; drag the focus back and the lights sharpen while the figure dissolves.
      </p>
      <ol className="formulas">
        <Eq
          math={row(i("c"), o("="), frac(sup(i("f"), n(2)), i("N")), o("·"), frac(row(o("|"), i("d"), o("−"), i("s"), o("|")), row(i("d"), o("("), i("s"), o("−"), i("f"), o(")"))))}
          label="c equals f squared over N, times the size of d minus s, over d times s minus f"
        >
          The width of the blur disc for something at distance d when the lens is focused at s. Longer lens, wider aperture, or more distance between the two: more blur.
        </Eq>
      </ol>
    </Card>
  );
}

// --------------------------------------------------------------------------------------------- The thin lens.
function ThinLens() {
  const [uTo, setU] = useState(140);
  const [fTo, setF] = useState(60);
  const u = useGlide(uTo), f = useGlide(fTo); // the arrow and the focal points slide to where they are put
  const svg = useRef<SVGSVGElement>(null);
  const hgt = 40;
  const real = u > f + 0.5;
  const v = Math.abs(u - f) < 0.5 ? 1e6 : (u * f) / (u - f);
  const m = -v / u, ih = m * hgt;
  const W = 200;
  const far = (x: number, y: number, slope: number) => `${W},${y + slope * (W - x)}`;
  const drag = (e: React.PointerEvent) => {
    if (e.buttons !== 1 && e.pointerType === "mouse" && e.type !== "pointerdown") return;
    const box = svg.current!.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * (W * 2) - W;
    setU(Math.max(20, Math.min(190, Math.round(-x))));
  };
  return (
    <Card
      kicker="Lenses"
      title="How a lens makes a picture"
      pic={
        <svg ref={svg} viewBox={`${-W} -100 ${W * 2} 200`} className="ph-lens" role="img" aria-label={`A lens of focal length ${fTo} with an object ${uTo} away. The image forms ${real ? `${Math.round(v)} behind the lens, upside down` : "on the same side as the object, upright and enlarged"}.`} onPointerDown={drag} onPointerMove={drag}>
          <line x1={-W} x2={W} y1="0" y2="0" className="lens-axis" />
          <path d="M0,-80Q14,0 0,80Q-14,0 0,-80Z" className="lens-glass" />
          {[-f, f].map((x) => (
            <g key={x}>
              <circle cx={x} cy="0" r="2.6" className="lens-focus" />
              <text x={x} y="14" textAnchor="middle" className="lens-label">
                F
              </text>
            </g>
          ))}
          {/* The three rays. */}
          <polyline points={`${-u},${-hgt} 0,${-hgt} ${far(0, -hgt, hgt / f)}`} className="lens-ray r1" />
          <polyline points={`${-u},${-hgt} ${far(-u, -hgt, hgt / u)}`} className="lens-ray r2" />
          {real && <polyline points={`${-u},${-hgt} 0,${-ih} ${W},${-ih}`} className="lens-ray r3" />}
          {!real && (
            <>
              <line x1="0" y1={-hgt} x2={v} y2={-ih} className="lens-ray back" />
              <line x1={-u} y1={-hgt} x2={v} y2={-ih} className="lens-ray back" />
            </>
          )}
          {/* The object, and its image. */}
          <g className="lens-thing">
            <line x1={-u} x2={-u} y1="0" y2={-hgt} />
            <path d={`M${-u - 5},${-hgt + 7}L${-u},${-hgt}L${-u + 5},${-hgt + 7}`} />
          </g>
          {Math.abs(v) < W && (
            <g className={real ? "lens-thing image" : "lens-thing image ghost"}>
              <line x1={v} x2={v} y1="0" y2={-ih} />
              <path d={`M${v - 5},${-ih + Math.sign(ih) * 7}L${v},${-ih}L${v + 5},${-ih + Math.sign(ih) * 7}`} />
            </g>
          )}
          <circle cx={-u} cy={-hgt} r="9" className="lens-grab" />
        </svg>
      }
      controls={
        <>
          <Slide label={`Object distance u = ${uTo}`} min={20} max={190} value={uTo} onChange={(e) => setU(Number(e.target.value))} aria-label="Object distance" />
          <Slide label={`Focal length f = ${fTo}`} min={30} max={110} value={fTo} onChange={(e) => setF(Number(e.target.value))} aria-label="Focal length" />
        </>
      }
    >
      <p>
        Drag the arrow. {real ? (
          <>
            The image forms <strong>{Math.round(v)}</strong> behind the lens, upside down and <strong>{Math.abs(m).toFixed(2)}×</strong> the size. That is where the sensor has to sit, and focusing is just moving the lens until it does.
          </>
        ) : (
          <>
            Inside the focal length the rays never meet. Traced backwards they seem to come from a larger, upright image behind the object: <strong>a magnifying glass</strong>.
          </>
        )}
      </p>
      <ol className="formulas">
        <Eq math={row(frac(n(1), i("f")), o("="), frac(n(1), i("u")), o("+"), frac(n(1), i("v")), gap, i("m"), o("="), o("−"), frac(i("v"), i("u")))} label="One over f equals one over u plus one over v. m equals minus v over u.">
          The thin lens equation, and the magnification. As u goes to infinity, v goes to f: distant things focus one focal length behind the lens.
        </Eq>
      </ol>
    </Card>
  );
}

// --------------------------------------------------------------------------------------------- Focal length and field of view.
const FOCALS = [14, 24, 35, 50, 85, 135, 200];
function FieldOfView() {
  const [at, setAt] = useState(2);
  const live = useRef({ now: 35, want: 35, t: 0 });
  live.current.want = FOCALS[at];
  const ref = useCanvas((g, w, h, dt) => {
    const s = live.current;
    s.t += dt;
    s.now *= Math.exp(Math.log(s.want / s.now) * Math.min(1, dt * 3)); // glide between lenses, like turning a zoom ring
    const per = w / (2 * (18 / s.now)); // pixels per unit of tan(angle), for a 36 mm wide sensor
    const cx = w / 2, hz = h * 0.6;
    const X = (deg: number) => cx + Math.tan((deg * Math.PI) / 180) * per, Y = (deg: number) => hz - Math.tan((deg * Math.PI) / 180) * per;
    g.clearRect(0, 0, w, h);
    const sky = g.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, "#2b2440");
    sky.addColorStop(0.6, "#a878aa");
    sky.addColorStop(1, "#f2c1a8");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, hz);
    g.fillStyle = "#ffe3c4";
    g.beginPath(); g.arc(X(9), Y(5), Math.max(2, per * 0.012), 0, 7); g.fill();
    // Far mountains, a nearer ridge, the ground.
    const ridge = (fill: string, tops: [number, number][]) => {
      g.fillStyle = fill;
      g.beginPath();
      g.moveTo(X(-80), hz + 2);
      tops.forEach(([a, e]) => g.lineTo(X(a), Y(e)));
      g.lineTo(X(80), hz + 2);
      g.fill();
    };
    ridge("#6a4f80", [[-70, 2], [-48, 7], [-30, 3], [-12, 9], [2, 4.5], [14, 6], [30, 2.5], [52, 8], [72, 2]]);
    ridge("#4a3560", [[-75, 1], [-40, 2.6], [-20, 1.2], [6, 2.4], [26, 1], [60, 3], [78, 1]]);
    g.fillStyle = "#2c2038";
    g.fillRect(0, hz, w, h - hz);
    // A cabin, a tree and a walker, each a fixed number of degrees across.
    const box = (a: number, e0: number, e1: number, wide: number, fill: string) => { g.fillStyle = fill; g.fillRect(X(a - wide / 2), Y(e1), X(a + wide / 2) - X(a - wide / 2), Y(e0) - Y(e1)); };
    box(-4, -0.6, 1.1, 3, "#1f1428");
    g.fillStyle = "#1f1428";
    g.beginPath(); g.moveTo(X(-5.9), Y(1.1)); g.lineTo(X(-4), Y(2.4)); g.lineTo(X(-2.1), Y(1.1)); g.fill();
    box(-4.5, 0, 0.6, 0.5, "#ffd27a");
    box(-21, -3, 2, 0.8, "#1a1122");
    g.fillStyle = "#1a1122";
    g.beginPath(); g.arc(X(-21), Y(6), Math.abs(X(4.5) - X(0)), 0, 7); g.fill();
    // The walker, strolling to and fro, and a cloud drifting over.
    const walk = 3.2 + Math.sin(s.t * 0.35) * 2.2, bob = Math.abs(Math.sin(s.t * 5)) * 0.04;
    box(walk, -1, 0.1 + bob, 0.22, "#ddb3cb");
    g.fillStyle = "#ddb3cb";
    g.beginPath(); g.arc(X(walk), Y(0.32 + bob), Math.abs(X(0.17) - X(0)), 0, 7); g.fill();
    const drift = ((s.t * 0.8) % 80) - 40;
    g.fillStyle = "rgba(243,238,242,0.35)";
    [[0, 11, 5], [3.5, 11.6, 4], [-3, 10.6, 3.4]].forEach(([dx, e, r]) => { g.beginPath(); g.ellipse(X(drift + dx), Y(e), Math.abs(X(r) - X(0)), Math.abs(X(r) - X(0)) * 0.32, 0, 0, 7); g.fill(); });
    // From above: the wedge the lens sees.
    const half = Math.atan(18 / s.now), ox = 44, oy = h - 16, len = 52;
    g.fillStyle = "rgba(11,8,16,0.55)";
    g.beginPath(); g.roundRect(8, h - 84, 72, 76, 12); g.fill();
    g.fillStyle = "rgba(221,179,203,0.5)";
    g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, len, -Math.PI / 2 - half, -Math.PI / 2 + half); g.fill();
    g.fillStyle = "#f3eef2";
    g.fillRect(ox - 5, oy - 3, 10, 7);
  });
  const f = FOCALS[at];
  const angle = (2 * Math.atan(18 / f) * 180) / Math.PI;
  return (
    <Card
      flip
      kicker="Focal length"
      title="Wide, normal, long"
      pic={<canvas ref={ref} className="sim wave ph-frame" role="img" aria-label={`A landscape seen through a ${f} millimetre lens, ${angle.toFixed(0)} degrees wide`} />}
      controls={
        <div className="ph-stops" role="group" aria-label="Focal length">
            <Pill />
          {FOCALS.map((v, k) => (
            <button key={v} type="button" aria-pressed={k === at} onClick={() => setAt(k)}>
              {v}
            </button>
          ))}
        </div>
      }
    >
      <p>
        Nothing in the scene moves when you change lens. The cabin, the tree and the walker stay at the same angles from the camera. The focal length only decides how many degrees fit across the sensor: at <strong>{f} mm</strong> a full-frame camera sees <strong>{angle.toFixed(0)}°</strong>. Around 50 mm looks about the way your eye does.
      </p>
      <ol className="formulas">
        <Eq math={row(i("θ"), o("="), n(2), fn("arctan", frac(i("w"), n(2) + i("f"))))} label="Theta equals two times the arctangent of w over two f">
          The angle of view for a sensor w wide (36 mm on full frame). Halve the sensor and the same lens sees half as much, which is all a &ldquo;crop factor&rdquo; is.
        </Eq>
      </ol>
    </Card>
  );
}

// --------------------------------------------------------------------------------------------- Shutter speed.
const SHUTTERS = [1 / 2000, 1 / 500, 1 / 125, 1 / 30, 1 / 8, 1 / 2];
const MOVERS = [
  { name: "Walking", v: 1.4 },
  { name: "Cycling", v: 7 },
  { name: "A car", v: 22 },
];
const shutterName = (s: number) => `1/${Math.round(1 / s)}`;
const DROPS = Array.from({ length: 46 }, (_, k) => ({ x: ((Math.sin(k * 12.99) * 43758.5) % 1 + 1) % 1, phase: ((Math.sin(k * 78.23) * 43758.5) % 1 + 1) % 1, len: 0.5 + (((Math.sin(k * 3.7) * 9631.1) % 1 + 1) % 1) * 0.8 }));
// One instant of the little world, or (with `open` above zero) everything that happened while the shutter was open.
function shutterWorld(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, time: number, wheelAt: number, speed: number, open: number) {
  g.save();
  g.beginPath();
  g.rect(x0, y0, w, h);
  g.clip();
  g.translate(x0, y0);
  const metre = w / 8, ground = h * 0.84; // the frame is 8 m across
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#1a1430");
  sky.addColorStop(1, "#3a2a52");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // How many instants to lay on top of each other: more for a longer smear, one for a frozen moment.
  const farthest = Math.max(Math.abs(speed) * open * metre, 4.2 * open * metre, 2.6 * open * h * 0.2);
  const steps = open <= 0 ? 1 : Math.max(1, Math.min(48, Math.round(farthest / 2.2)));
  const alpha = steps === 1 ? 1 : Math.max(0.045, 1.7 / steps);
  // The cliff the water falls from, and the windmill's tower, which do not move.
  g.fillStyle = "#241a36";
  g.fillRect(0, h * 0.16, w * 0.2, ground - h * 0.16);
  g.fillStyle = "#2c2040";
  g.beginPath();
  g.moveTo(w * 0.79, ground); g.lineTo(w * 0.815, h * 0.3); g.lineTo(w * 0.845, h * 0.3); g.lineTo(w * 0.87, ground);
  g.fill();
  g.fillStyle = "rgba(167,155,178,0.35)";
  g.fillRect(0, ground + 2, w, 2);
  for (let k = 0; k < steps; k++) {
    const t = time - (steps === 1 ? 0 : (k / (steps - 1)) * open);
    g.globalAlpha = alpha;
    // Water, falling at about four metres a second.
    g.strokeStyle = "#cfe4f5";
    g.lineWidth = 1.6;
    g.lineCap = "round";
    for (const d of DROPS) {
      const fall = (((d.phase + (t * 4.2 * metre) / (ground - h * 0.16)) % 1) + 1) % 1;
      const x = w * (0.03 + d.x * 0.15), y = h * 0.16 + fall * (ground - h * 0.16);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + d.len * 5); g.stroke();
    }
    // The windmill, turning steadily.
    const hubX = w * 0.83, hubY = h * 0.3, arm = h * 0.2, turn = t * 2.6;
    g.strokeStyle = "#f3eef2";
    g.lineWidth = Math.max(2.5, arm * 0.11);
    for (let blade = 0; blade < 4; blade++) {
      const a = turn + (blade * Math.PI) / 2;
      g.beginPath(); g.moveTo(hubX, hubY); g.lineTo(hubX + arm * Math.cos(a), hubY + arm * Math.sin(a)); g.stroke();
    }
    // The wheel, going as fast as it was last flung.
    const r = h * 0.13, at = wheelAt - speed * (time - t);
    const cx = ((((at + 1) % 10) + 10) % 10 - 1) * metre, cy = ground - r;
    g.lineWidth = Math.max(2, r * 0.16);
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    g.lineWidth = Math.max(1, r * 0.07);
    const roll = (at * metre) / r;
    for (let spoke = 0; spoke < 6; spoke++) {
      const a = roll + (spoke / 6) * 6.2832;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); g.stroke();
    }
    g.fillStyle = "#ddb3cb";
    g.beginPath(); g.arc(cx + r * 0.72 * Math.cos(roll), cy + r * 0.72 * Math.sin(roll), r * 0.14, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  g.fillStyle = "#f3eef2";
  g.beginPath(); g.arc(w * 0.83, h * 0.3, 3.5, 0, 7); g.fill();
  g.restore();
}
function Shutter() {
  const [at, setAt] = useState(2);
  const [speed, setSpeed] = useState(7);
  const [prints, setPrints] = useState<{ id: number; src: string; label: string }[]>([]);
  const [flash, setFlash] = useState(0);
  const live = useRef({ at, target: 7, v: 7, x: 0, t: SHUTTERS[at], time: 0, drag: null as null | { x: number; when: number; moved: number } });
  live.current.at = at;
  live.current.target = speed;
  const count = useRef(0);
  const ref = useCanvas((g, w, h, dt) => {
    const s = live.current;
    s.time += dt * 0.35; // the world is shown slowed down, so it can be followed
    s.t = Math.exp(ease(Math.log(s.t), Math.log(SHUTTERS[s.at]), dt, 6)); // shutter times are a ladder of doublings, so ease along that
    s.v = ease(s.v, s.target, dt, 5);
    s.x += s.v * dt * 0.35;
    g.clearRect(0, 0, w, h);
    const half = Math.floor(h / 2);
    shutterWorld(g, 0, 0, w, half - 1, s.time, s.x, s.v, 0);
    shutterWorld(g, 0, half + 1, w, h - half - 1, s.time, s.x, s.v, s.t);
    g.fillStyle = "rgba(243,238,242,0.85)";
    g.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
    g.fillText("WHAT IS HAPPENING · SWIPE TO FLING THE WHEEL", 10, 14);
    g.fillText(`WHAT THE CAMERA KEEPS AT ${shutterName(SHUTTERS[s.at])} S`, 10, half + 15);
  });
  const shoot = () => {
    const print = document.createElement("canvas");
    print.width = 420;
    print.height = 200;
    const g = print.getContext("2d");
    if (!g) return;
    const s = live.current;
    shutterWorld(g, 0, 0, 420, 200, s.time, s.x, s.v, SHUTTERS[at]);
    count.current += 1;
    setPrints((list) => [{ id: count.current, src: print.toDataURL("image/jpeg", 0.85), label: `${shutterName(SHUTTERS[at])} s · ${Math.abs(s.v).toFixed(0)} m/s` }, ...list].slice(0, 3));
    setFlash((f) => f + 1);
  };
  const moved = Math.abs(speed) * SHUTTERS[at];
  return (
    <Card
      kicker="Shutter speed"
      title="Freezing time, or letting it run"
      pic={
        <div className="ph-shutter">
          <canvas
            ref={ref}
            className="sim wave ph-frame"
            role="img"
            aria-label={`A waterfall, a windmill and a rolling wheel, and underneath the photograph of them at ${shutterName(SHUTTERS[at])} of a second`}
            onPointerDown={(e) => (live.current.drag = { x: e.clientX, when: performance.now(), moved: 0 })}
            onPointerMove={(e) => {
              const d = live.current.drag;
              if (!d) return;
              const dx = e.clientX - d.x, dtm = Math.max(8, performance.now() - d.when);
              d.moved += Math.abs(dx);
              // A swipe sets the wheel going at the speed of the finger: 8 metres is the width of the frame.
              if (d.moved > 12) setSpeed(Math.max(-30, Math.min(30, Math.round((((dx / dtm) * 1000) / e.currentTarget.clientWidth) * 8 * 2.4))));
              live.current.drag = { x: e.clientX, when: performance.now(), moved: d.moved };
            }}
            onPointerUp={() => (live.current.drag = null)}
            onPointerCancel={() => (live.current.drag = null)}
          />
          {flash > 0 && <i key={flash} className="flash" />}
        </div>
      }
      controls={
        <>
          <div className="ph-stops" role="group" aria-label="Shutter speed">
            <Pill />
            {SHUTTERS.map((v, k) => (
              <button key={v} type="button" aria-pressed={k === at} onClick={() => setAt(k)}>
                {shutterName(v)}
              </button>
            ))}
          </div>
          <div className="ph-stops" role="group" aria-label="How fast the wheel is moving">
            <Pill />
            {MOVERS.map((mv) => (
              <button key={mv.name} type="button" aria-pressed={Math.abs(Math.abs(speed) - mv.v) < 0.6} onClick={() => setSpeed(mv.v)}>
                {mv.name}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost small" onClick={shoot}>
            Take the photo
          </button>
          {prints.length > 0 && (
            <div className="ph-prints" aria-live="polite">
              {prints.map((p) => (
                <figure key={p.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt={`The photograph at ${p.label}`} width={420} height={200} />
                  <figcaption className="mono">{p.label}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </>
      }
    >
      <p>
        Three things are moving: water falling, a windmill turning, and a wheel you can fling by swiping across the picture. At <strong>{shutterName(SHUTTERS[at])} s</strong>, the wheel at {Math.abs(speed).toFixed(0)} m/s travels <strong>{moved >= 1 ? `${moved.toFixed(1)} m` : moved >= 0.01 ? `${(moved * 100).toFixed(0)} cm` : `${(moved * 1000).toFixed(1)} mm`}</strong> while the shutter is open. That distance is the blur. A fast shutter freezes every drop; a slow one turns the water to silk and the windmill to a disc, which is how you show movement on purpose.
      </p>
      <ol className="formulas">
        <Eq math={row(i("blur"), o("="), i("v"), i("t"), gap, i("light"), o("∝"), i("t"))} label="Blur equals v times t. Light is proportional to t.">
          Halving the time halves the blur and also halves the light: one stop, to be paid back with aperture or ISO.
        </Eq>
        <Eq math={row(i("t"), o("="), frac(n(1), n(2) + o("×") + i("fps")))} label="t equals one over two times the frame rate">
          For video, the 180° rule: a shutter open for half of each frame gives motion the blur we are used to. At 24 frames a second that is 1/48 s.
        </Eq>
      </ol>
    </Card>
  );
}

// --------------------------------------------------------------------------------------------- Light: how fast it falls off with distance, and what…
function kelvin(k: number) {
  // A standard approximation of the colour of a glowing body at a given temperature.
  const t = k / 100;
  const r = t <= 66 ? 255 : 329.7 * (t - 60) ** -0.1332;
  const gr = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * (t - 60) ** -0.0755;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  return [r, gr, b].map((v) => Math.round(Math.max(0, Math.min(255, v))));
}
function Light() {
  const [d, setD] = useState(1.5);
  const [k, setK] = useState(3200);
  const live = useRef({ d, k, t: 0, ed: d, ek: k });
  live.current.d = d;
  live.current.k = k;
  const ref = useCanvas((g, w, h, dt) => {
    const s = live.current;
    s.t += dt;
    s.ed = ease(s.ed, s.d, dt);
    s.ek = ease(s.ek, s.k, dt);
    const [r, gr, b] = kelvin(s.ek);
    const flicker = s.ek < 2600 ? 0.9 + 0.1 * Math.sin(s.t * 11) * Math.sin(s.t * 6.3) : 1; // candles gutter
    const level = Math.min(1, 1 / (s.ed * s.ed)) * flicker; // full at one metre
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#0d0916";
    g.fillRect(0, 0, w, h);
    const sx = w * 0.78, sy = h * 0.52, rad = Math.min(w, h) * 0.26;
    const lx = sx - (s.ed / 4) * (w * 0.68), ly = h * 0.36;
    // The lamp and its pool of light.
    const pool = g.createRadialGradient(lx, ly, 0, lx, ly, w * 0.7);
    pool.addColorStop(0, `rgba(${r},${gr},${b},0.55)`);
    pool.addColorStop(0.25, `rgba(${r},${gr},${b},0.14)`);
    pool.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    g.fillStyle = pool;
    g.fillRect(0, 0, w, h);
    g.fillStyle = `rgb(${r},${gr},${b})`;
    g.beginPath(); g.arc(lx, ly, 7, 0, 7); g.fill();
    // A ball, lit from the lamp's side.
    const a = Math.atan2(ly - sy, lx - sx);
    const shade = g.createRadialGradient(sx + Math.cos(a) * rad * 0.55, sy + Math.sin(a) * rad * 0.55, rad * 0.05, sx, sy, rad * 1.15);
    const lit = (f: number) => `rgb(${Math.round(r * level * f + 14)},${Math.round(gr * level * f + 10)},${Math.round(b * level * f + 18)})`;
    shade.addColorStop(0, lit(1));
    shade.addColorStop(0.55, lit(0.45));
    shade.addColorStop(1, lit(0.04));
    g.fillStyle = shade;
    g.beginPath(); g.arc(sx, sy, rad, 0, 7); g.fill();
    g.strokeStyle = "rgba(167,155,178,0.5)";
    g.setLineDash([3, 4]);
    g.beginPath(); g.moveTo(lx, h - 18); g.lineTo(sx, h - 18); g.stroke();
    g.setLineDash([]);
    g.fillStyle = "rgba(167,155,178,0.9)";
    g.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    g.textAlign = "center";
    g.fillText(`${s.d.toFixed(1)} m`, (lx + sx) / 2, h - 6);
  });
  const stops = 2 * Math.log2(d);
  const name = k < 2400 ? "candlelight" : k < 3600 ? "a household bulb" : k < 4800 ? "early morning sun" : k < 6000 ? "midday sun" : k < 7500 ? "an overcast sky" : "open shade under blue sky";
  return (
    <Card
      flip
      kicker="Light"
      title="How much, and what colour"
      pic={<canvas ref={ref} className="sim wave ph-frame" role="img" aria-label={`A ball lit by a lamp ${d.toFixed(1)} metres away with a colour temperature of ${k} kelvin`} />}
      controls={
        <>
          <Slide label={`Lamp distance ${d.toFixed(1)} m`} min={0.6} max={4} step={0.1} value={d} onChange={(e) => setD(Number(e.target.value))} aria-label="Lamp distance" />
          <Slide label={`Colour ${k} K`} min={1800} max={10000} step={100} value={k} onChange={(e) => setK(Number(e.target.value))} aria-label="Colour temperature" />
        </>
      }
    >
      <p>
        Move the lamp from 1 m to {d.toFixed(1)} m and the ball gets <strong>{d === 1 ? "the same light" : d > 1 ? `1/${(d * d).toFixed(1)} of the light` : `${(1 / (d * d)).toFixed(1)}× the light`}</strong>{d !== 1 ? ` (${Math.abs(stops).toFixed(1)} stops ${stops > 0 ? "darker" : "brighter"})` : ""}. This is why a window is soft and even across a room, and a phone torch is harsh. The colour, {k} K, is about that of <strong>{name}</strong>; white balance is telling the camera which of these to call white.
      </p>
      <ol className="formulas">
        <Eq math={row(i("E"), o("="), frac(i("I"), sup(i("d"), n(2))))} label="E equals I over d squared">
          The inverse square law. Twice as far, a quarter of the light: two stops.
        </Eq>
        <Eq math={row(sub(i("λ"), i("peak")), o("="), frac(i("b"), i("T")))} label="Lambda peak equals b over T">
          Wien&rsquo;s law: the hotter something glows, the shorter (bluer) the wavelength it glows brightest at. So &ldquo;warm&rdquo; light is, confusingly, the cooler source.
        </Eq>
      </ol>
    </Card>
  );
}

export function PhotoLab() {
  return (
    <div className="waves">
      <Aperture />
      <Bokeh />
      <ThinLens />
      <FieldOfView />
      <Shutter />
      <Light />
    </div>
  );
}
