"use client";

import { useSite } from "@/components/Content";
import { site } from "@/lib/site";

const ICONS = {
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10 9.200v5.600l5-2.800z" fill="currentColor" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.500" y="3.500" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.800" />
      <circle cx="17" cy="7" r="0.6" fill="currentColor" />
    </>
  ),
  strava: <path d="M10.2 3 4.5 14h3.6l2.1-4 2.1 4h3.6zM13.4 14l-1.8 3.4L9.800 14M17.900 14l-2.200 4.200L13.400 14" />,
};
const NAMES = { youtube: "YouTube", instagram: "Instagram", strava: "Strava" };

// Buttons out to my profiles elsewhere. A profile left empty in lib/site.ts is left out.
export function Social({ which }: { which: (keyof typeof ICONS)[] }) {
  const site = useSite();
  const list = which.filter((k) => site.social[k]);
  if (!list.length) return null;
  return (
    <div className="social">
      {list.map((k) => (
        <a key={k} className="btn btn-glass glass small" href={site.social[k]} target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[k]}
          </svg>
          {NAMES[k]}
        </a>
      ))}
    </div>
  );
}
