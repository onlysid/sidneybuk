import { assets } from "@/lib/assets";
import type { Piece } from "@/lib/portfolio";
import { Shot } from "./Shot";

// The picture for a piece of work: its first screenshot if it has one, otherwise a drawn illustration of what the thing is.
export function WorkArt({ piece, n = 0 }: { piece: Piece; n?: number }) {
  if (piece.live === "logo")
    return (
      <div className="work-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assets.logo} alt="The sidneyb.uk logo" />
      </div>
    );
  const shot = piece.images?.[0];
  // A real picture where there is one; if it cannot load, the drawn illustration takes its place.
  if (shot)
    return (
      <div className="work-pic">
        <Shot className="work-shot" src={assets.work[shot.src]} alt={shot.alt} upTo={720} sizes="(max-width: 760px) 100vw, 720px" fallback={<Drawn piece={piece} n={n} />} />
        {shot.badge && <Shot className="work-badge" src={assets.work[shot.badge]} alt="" />}
      </div>
    );
  return <Drawn piece={piece} n={n} />;
}

function Drawn({ piece, n }: { piece: Piece; n: number }) {
  if (piece.art === "wheel") {
    // A roulette wheel from above, turning, with a spirit level finding its centre.
    const pockets = Array.from({ length: 37 }, (_, i) => i);
    return (
      <svg viewBox="0 0 320 200" className="work-art" role="img" aria-label="Illustration: a roulette wheel seen from above, with a spirit level settling at its centre">
        <g transform="translate(118 100)">
          <circle r="86" fill="#201a26" />
          <g className="wa-spin">
            {pockets.map((i) => {
              const a0 = (i / 37) * Math.PI * 2, a1 = ((i + 1) / 37) * Math.PI * 2;
              const p = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;
              return <path key={i} d={`M${p(52, a0)}L${p(78, a0)}A78 78 0 0 1 ${p(78, a1)}L${p(52, a1)}A52 52 0 0 0 ${p(52, a0)}Z`} fill={i === 0 ? "#9fe0b8" : i % 2 ? "#684780" : "#ddb3cb"} stroke="#201a26" strokeWidth="1" />;
            })}
            <circle r="52" fill="#3a2f45" />
            <path d="M-40 0H40M0 -40V40" stroke="#a878aa" strokeWidth="5" strokeLinecap="round" />
            <circle r="13" fill="#ddb3cb" />
          </g>
          <circle className="wa-ball" r="5" fill="#fff" />
          <circle r="86" fill="none" stroke="#a878aa" strokeWidth="3" />
        </g>
        <g transform="translate(262 100)">
          <circle r="40" fill="#f3eef2" />
          <circle r="40" fill="none" stroke="#684780" strokeWidth="3" />
          <circle r="13" fill="none" stroke="#684780" strokeWidth="1.5" />
          <path d="M-40 0H40M0 -40V40" stroke="#684780" strokeWidth="1" opacity="0.5" />
          <circle className="wa-bubble" r="10" fill="#9fe0b8" stroke="#2c7a52" strokeWidth="1.5" />
        </g>
      </svg>
    );
  }
  if (piece.art === "pitch") {
    // A football pitch from above, with a move being played through it.
    const move = "M40 150C90 150 90 96 140 100S190 54 232 62S270 96 292 100";
    return (
      <svg viewBox="0 0 320 200" className="work-art" role="img" aria-label="Illustration: a football pitch from above, with a passing move running through to the goal">
        <rect width="320" height="200" fill="#3a2f45" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect key={i} x={i * 40} width="20" height="200" fill="#443653" />
        ))}
        <g fill="none" stroke="#f3eef2" strokeWidth="2" opacity="0.8">
          <rect x="14" y="14" width="292" height="172" rx="2" />
          <path d="M160 14V186" />
          <circle cx="160" cy="100" r="28" />
          <rect x="14" y="56" width="42" height="88" />
          <rect x="264" y="56" width="42" height="88" />
          <rect x="14" y="80" width="16" height="40" />
          <rect x="290" y="80" width="16" height="40" />
        </g>
        <path className="wa-move" d={move} pathLength={1} fill="none" stroke="#ddb3cb" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.03 0.03" />
        {[[40, 150], [140, 100], [232, 62]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="7" fill="#ddb3cb" stroke="#201a26" strokeWidth="2" />
        ))}
        <circle r="5" fill="#fff" stroke="#201a26" strokeWidth="1.5">
          <animateMotion dur="4s" repeatCount="indefinite" path={move} keyPoints="0;1;1" keyTimes="0;0.8;1" calcMode="linear" />
        </circle>
      </svg>
    );
  }
  return (
    <div className="piece-cover" style={{ ["--n" as string]: n }} aria-hidden="true">
      <span>{String(n + 1).padStart(2, "0")}</span>
    </div>
  );
}
