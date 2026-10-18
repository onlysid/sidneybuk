"use client";

import { useState } from "react";
import { Pic } from "./Pic";

// A picture that steps aside if it cannot load (the other site is down, or blocks being embedded), showing whatever was given as the fallback…
export function Shot({ src, alt, className, fallback, upTo = 900, sizes }: { src: string; alt: string; className?: string; fallback?: React.ReactNode; upTo?: number; sizes?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) return <>{fallback}</>;
  // (An empty fallback leaves nothing behind; the CSS hides a frame whose picture did not load.)
  // eslint-disable-next-line @next/next/no-img-element
  return <Pic className={className} src={src} alt={alt} upTo={upTo} sizes={sizes} onError={() => setFailed(true)} />;
}
