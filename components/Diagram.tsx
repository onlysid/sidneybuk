"use client";

import { useMemo } from "react";

// A small diagram, written as a list of arrows:
//
//   direction: right          (optional; the default is down)
//   Subgroup -> Cosets: shift by g
//   Cosets -> Lagrange
//
// Each name becomes a box and each line an arrow, with whatever follows the colon written on it. The boxes
// are arranged in rows (or columns) so that every arrow points onwards. It is meant for the diagrams a
// notebook needs: how ideas depend on each other, the steps of a process, a small tree. For anything
// more elaborate, draw it elsewhere and drop the picture in.
type Edge = { from: string; to: string; label: string };
const W = 7.4; // roughly the width of one letter, in the font used

export function Diagram({ source }: { source: string }) {
  const drawn = useMemo(() => {
    let across = false;
    const edges: Edge[] = [], names: string[] = [];
    const meet = (n: string) => (names.includes(n) || names.push(n), n);
    for (const raw of source.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const dir = line.match(/^direction:\s*(\w+)/i);
      if (dir) {
        across = /right|across|left/i.test(dir[1]);
        continue;
      }
      const [path, ...rest] = line.split(":");
      const stops = path.split("->").map((s) => s.trim()).filter(Boolean);
      if (stops.length === 1) meet(stops[0]);
      for (let k = 0; k + 1 < stops.length; k++) edges.push({ from: meet(stops[k]), to: meet(stops[k + 1]), label: k === stops.length - 2 ? rest.join(":").trim() : "" });
    }
    if (!names.length) return null;
    // Which row each box sits in: one further on than the furthest thing pointing at it.
    const rank = new Map<string, number>();
    const visiting = new Set<string>();
    const place = (n: string): number => {
      if (rank.has(n)) return rank.get(n)!;
      if (visiting.has(n)) return -1;
      visiting.add(n);
      const r = Math.max(-1, ...edges.filter((e) => e.to === n && e.from !== n).map((e) => place(e.from))) + 1;
      visiting.delete(n);
      rank.set(n, r);
      return r;
    };
    names.forEach(place);
    const rows: string[][] = [];
    names.forEach((n) => (rows[rank.get(n)!] ??= []).push(n));
    // Within a row, sit each box near the average of what points at it, so arrows cross less.
    const spot = new Map<string, number>();
    rows.forEach((row, r) => {
      if (r > 0) {
        const mean = (n: string) => {
          const ups = edges.filter((e) => e.to === n && spot.has(e.from)).map((e) => spot.get(e.from)!);
          return ups.length ? ups.reduce((a, b) => a + b, 0) / ups.length : 0.5;
        };
        row.sort((a, b) => mean(a) - mean(b));
      }
      row.forEach((n, k) => spot.set(n, (k + 0.5) / row.length));
    });
    const wide = (n: string) => Math.max(64, n.length * W + 30), tall = 40;
    const gapAlong = across ? 74 : 62, gapSide = 22;
    const breadth = Math.max(...rows.map((row) => row.reduce((a, n) => a + (across ? tall : wide(n)) + gapSide, -gapSide)));
    const depth = rows.map((row) => (across ? Math.max(...row.map(wide)) : tall));
    const boxes = new Map<string, { x: number; y: number; w: number; h: number }>();
    let along = 0;
    rows.forEach((row, r) => {
      const used = row.reduce((a, n) => a + (across ? tall : wide(n)) + gapSide, -gapSide);
      let side = (breadth - used) / 2;
      for (const n of row) {
        const w = wide(n);
        boxes.set(n, across ? { x: along + (depth[r] - w) / 2, y: side, w, h: tall } : { x: side, y: along, w, h: tall });
        side += (across ? tall : w) + gapSide;
      }
      along += depth[r] + gapAlong;
    });
    const width = across ? along - gapAlong : breadth, height = across ? breadth : along - gapAlong;
    const arrows = edges.map((e) => {
      const a = boxes.get(e.from)!, b = boxes.get(e.to)!;
      const back = rank.get(e.to)! <= rank.get(e.from)!;
      // Leave from the far edge of one box and arrive at the near edge of the next, with a gentle bend.
      const x1 = across ? (back ? a.x : a.x + a.w) : a.x + a.w / 2, y1 = across ? a.y + a.h / 2 : back ? a.y : a.y + a.h;
      const x2 = across ? (back ? b.x + b.w : b.x) : b.x + b.w / 2, y2 = across ? b.y + b.h / 2 : back ? b.y + b.h : b.y;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const d = across ? `M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}` : `M${x1} ${y1}C${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
      return { d, label: e.label, lx: mx, ly: my, key: `${e.from}>${e.to}>${e.label}` };
    });
    return { width, height, boxes: [...boxes.entries()], arrows };
  }, [source]);
  if (!drawn) return null;
  const pad = 14;
  return (
    <figure className="nb-diagram">
      <svg viewBox={`${-pad} ${-pad} ${drawn.width + pad * 2} ${drawn.height + pad * 2}`} style={{ width: Math.min(760, drawn.width + pad * 2), maxWidth: "100%" }} role="img" aria-label={`Diagram: ${drawn.arrows.map((a) => a.key.split(">").slice(0, 2).join(" leads to ")).join("; ")}`}>
        <defs>
          <marker id="nb-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M1 1.5L9 5L1 8.500" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
        {drawn.arrows.map((a) => (
          <g key={a.key} className="nb-edge">
            <path d={a.d} markerEnd="url(#nb-arrow)" />
            {a.label && (
              <>
                <rect x={a.lx - (a.label.length * 6.2 + 12) / 2} y={a.ly - 10} width={a.label.length * 6.2 + 12} height="20" rx="10" />
                <text x={a.lx} y={a.ly + 4}>{a.label}</text>
              </>
            )}
          </g>
        ))}
        {drawn.boxes.map(([name, b]) => (
          <g key={name} className="nb-node">
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="12" />
            <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 4.5}>{name}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
