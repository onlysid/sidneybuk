"use client";

import { lazy, Suspense } from "react";

// The globe carries map data, so it is only downloaded on the travel page.
const Globe = lazy(() => import("./Globe"));

export function Travel() {
  return (
    <Suspense fallback={<div className="globe-wait mono">Unfolding the map…</div>}>
      <Globe />
    </Suspense>
  );
}
