"use client";

import { useEffect, useState } from "react";
import { TLink } from "./Transition";

// When this copy of the site was built: a small pill in the footer, with the exact time on hover and the
// commit it came from, if known. It leads to the changelog, which says what changed.
const AT = process.env.NEXT_PUBLIC_BUILT_AT ?? "";
const COMMIT = process.env.NEXT_PUBLIC_COMMIT ?? "";

function ago(iso: string, now: number) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  const m = s / 60, h = m / 60, d = h / 24;
  if (m < 60) return `${Math.round(m)} min ago`;
  if (h < 36) return `${Math.round(h)} h ago`;
  if (d < 14) return `${Math.round(d)} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: d > 300 ? "numeric" : undefined });
}

export function Built() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(t);
  }, []);
  if (!AT) return null;
  const exact = new Date(AT).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <TLink href="/changelog" className="built" title={`This version of the site was built ${exact}${COMMIT ? ` from ${COMMIT}` : ""}. See what changed.`}>
      <i className="built-dot" aria-hidden="true" />
      <span>Updated {now ? ago(AT, now) : "\u00a0"}</span>
      {COMMIT && <span className="built-sha">{COMMIT}</span>}
    </TLink>
  );
}
