import { SMALL, SPLIT, TEAR } from "@/lib/logo-paths";

// The logo cut for small sizes: the same tile and three strings, drawn heavier so they stay clear in the menu.
export function Mark({ id, className = "" }: { id: string; className?: string }) {
  return (
    <svg viewBox="8 8 112 112" className={`mark ${className}`} aria-hidden="true">
      <defs>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width="128" height="128">
          <rect width="128" height="128" fill="#fff" />
          {SMALL.map((d, n) => (
            <path key={n} d={d} fill="#000" />
          ))}
          <rect className="mark-us" x="84" y="94" width="20" height="8" rx="2" fill="#000" />
        </mask>
        <linearGradient id={`${id}t`} gradientUnits="userSpaceOnUse" x1="14" y1="14" x2="90" y2="90">
          <stop offset="0" stopColor="#DDB3CB" />
          <stop offset="1" stopColor="#A878AA" />
        </linearGradient>
        <linearGradient id={`${id}b`} gradientUnits="userSpaceOnUse" x1="40" y1="40" x2="114" y2="114">
          <stop offset="0" stopColor="#A878AA" />
          <stop offset="1" stopColor="#684780" />
        </linearGradient>
        <clipPath id={`${id}s`}>
          <path d={SPLIT} />
        </clipPath>
      </defs>
      <g mask={`url(#${id}m)`}>
        <path d={TEAR} fill={`url(#${id}t)`} />
        <g clipPath={`url(#${id}s)`}>
          <path d={TEAR} fill={`url(#${id}b)`} />
        </g>
      </g>
    </svg>
  );
}
