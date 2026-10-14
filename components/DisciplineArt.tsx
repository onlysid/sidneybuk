import type { Slug } from "@/lib/site";

const i = (n: number) => ({ ["--i" as string]: n }) as React.CSSProperties;

// Small looping drawings, one per discipline. All motion is CSS, so they cost nothing to run.
export function DisciplineArt({ kind }: { kind: Slug }) {
  if (kind === "code") {
    const lines = [
      [20, 70, "var(--rose)"],
      [36, 110, "var(--mauve)"],
      [36, 60, "var(--mauve)"],
      [52, 84, "var(--plum-soft)"],
      [20, 34, "var(--rose)"],
    ] as const;
    return (
      <svg viewBox="0 0 200 96" className="art bars" aria-hidden="true">
        {lines.map(([x, w, fill], n) => (
          <rect key={n} x={x} y={16 + n * 14} width={w} height={6} rx={3} fill={fill} style={i(n)} />
        ))}
        <rect className="art-cursor" x={62} y={72} width={14} height={4} rx={1.5} fill="var(--text)" />
      </svg>
    );
  }

  if (kind === "maths") {
    // A curve being plotted, with a point riding along it.
    const curve = "M24 48C44 4 64 4 84 48S124 92 144 48S164 20 176 34";
    return (
      <svg viewBox="0 0 200 96" className="art plot" aria-hidden="true">
        <path d="M24 16V80M16 48H184" fill="none" stroke="var(--edge)" strokeWidth={1.5} strokeLinecap="round" />
        <path className="plot-line" d={curve} pathLength={1} fill="none" stroke="var(--mauve)" strokeWidth={3} strokeLinecap="round" />
        <circle r={4.5} fill="var(--rose)">
          <animateMotion dur="5s" repeatCount="indefinite" path={curve} />
        </circle>
      </svg>
    );
  }

  if (kind === "music") {
    // White keys as outlines, black keys in their two-three grouping, pressed in turn.
    return (
      <svg viewBox="0 0 200 96" className="art keys" aria-hidden="true">
        {Array.from({ length: 7 }, (_, n) => (
          <rect key={n} x={30 + n * 20} y={22} width={18} height={52} rx={4} fill="none" stroke="var(--edge)" strokeWidth={1.5} />
        ))}
        {[0, 1, 3, 4, 5].map((slot, n) => (
          <rect key={slot} x={43 + slot * 20} y={22} width={12} height={30} rx={3} fill={n < 2 ? "var(--rose)" : "var(--mauve)"} style={i(n)} />
        ))}
      </svg>
    );
  }

  if (kind === "learning") {
    // Two speech bubbles taking turns.
    return (
      <svg viewBox="0 0 200 96" className="art talk" aria-hidden="true">
        <g style={i(0)}>
          <path d="M40 22h62a10 10 0 0 1 10 10v16a10 10 0 0 1-10 10H58l-12 10v-10h-6a10 10 0 0 1-10-10V32a10 10 0 0 1 10-10z" fill="none" stroke="var(--mauve)" strokeWidth={2.5} strokeLinejoin="round" />
          <text x="71" y="46" textAnchor="middle" fill="var(--rose)" fontSize="15" fontFamily="var(--display)">Labas</text>
        </g>
        <g style={i(1)}>
          <path d="M106 40h54a10 10 0 0 1 10 10v14a10 10 0 0 1-10 10h-6v9l-11-9h-37a10 10 0 0 1-10-10V50a10 10 0 0 1 10-10z" fill="var(--plum)" opacity={0.9} />
          <text x="133" y="62" textAnchor="middle" fill="#f3eef2" fontSize="14" fontFamily="var(--display)">Salut</text>
        </g>
      </svg>
    );
  }

  if (kind === "reading") {
    // A row of spines, one being pulled out.
    const spines = [
      [58, 30, 12, "var(--plum-soft)"],
      [72, 22, 15, "var(--rose)"],
      [89, 34, 11, "var(--mauve)"],
      [102, 26, 16, "var(--plum)"],
      [120, 32, 12, "var(--rose)"],
      [134, 24, 13, "var(--mauve)"],
    ] as const;
    return (
      <svg viewBox="0 0 200 96" className="art books" aria-hidden="true">
        {spines.map(([x, top, w, fill], n) => (
          <rect key={n} x={x} y={top} width={w} height={76 - top} rx={2.5} fill={fill} style={i(n)} />
        ))}
        <path d="M44 76H156" stroke="var(--edge)" strokeWidth={2} strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "travel") {
    // A dotted route with something flying along it.
    const route = "M26 70C60 10 110 14 174 34";
    return (
      <svg viewBox="0 0 200 96" className="art route" aria-hidden="true">
        <circle cx={100} cy={120} r={86} fill="none" stroke="var(--edge)" strokeWidth={1.5} />
        <path d={route} fill="none" stroke="var(--mauve)" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="1 9" />
        <circle cx={26} cy={70} r={5} fill="var(--plum-soft)" />
        <circle cx={174} cy={34} r={5} fill="var(--rose)" />
        <path d="M-7 0L6 -4.5L3 0L6 4.5Z" fill="var(--rose)" transform="scale(-1 1)">
          <animateMotion dur="4.5s" repeatCount="indefinite" path={route} rotate="auto" keyPoints="0;1;1" keyTimes="0;0.8;1" calcMode="linear" />
        </path>
      </svg>
    );
  }

  if (kind === "sport") {
    // A pulse.
    return (
      <svg viewBox="0 0 200 96" className="art pulse" aria-hidden="true">
        <path d="M16 52H70L80 30L92 72L104 18L114 60L122 52H184" pathLength={1} fill="none" stroke="var(--mauve)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={184} cy={52} r={4.5} fill="var(--rose)" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 200 96" className="art lens-art" aria-hidden="true">
      <rect x={52} y={20} width={96} height={56} rx={10} fill="none" stroke="var(--edge)" strokeWidth={1.5} />
      <circle className="ring" cx={100} cy={48} r={18} fill="none" stroke="var(--mauve)" strokeWidth={3} />
      <circle cx={100} cy={48} r={6} fill="var(--rose)" />
      <circle className="dot" cx={136} cy={31} r={3} fill="var(--rose)" />
    </svg>
  );
}
