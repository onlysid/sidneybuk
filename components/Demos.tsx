"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

// The interactive pieces built for other parts of the site can be put into a note, by name:
//
//   ```demo
//   double-slit
//   ```
//
// Each is only fetched by a page that uses it. To add one, build the component and give it a line here.
const wait = () => <p className="nb-wait">Setting it up…</p>;
const lazy = (load: () => Promise<ComponentType>) => dynamic(load, { ssr: false, loading: wait });
export const DEMOS: Record<string, { title: string; show: ComponentType; wrap?: string }> = {
  "string": { title: "A string you can pluck, with its harmonics", show: lazy(() => import("./toys/MusicScience").then((m) => m.PluckedString)) },
  "tuning": { title: "Tuning systems on a keyboard you can play", show: lazy(() => import("./toys/TuningLab").then((m) => m.TuningLab)) },
  "time-signatures": { title: "Time signatures you can hear", show: lazy(() => import("./toys/TimeSignatures").then((m) => m.TimeSignatures)) },
  "double-slit": { title: "The double-slit experiment", show: lazy(() => import("./toys/MathsPlay").then((m) => m.DoubleSlit)), wrap: "waves" },
  "proofs": { title: "Three proofs to play with", show: lazy(() => import("./toys/MathsPlay").then((m) => m.Proofs)), wrap: "waves" },
  "camera": { title: "A camera: aperture, shutter, ISO and focus", show: lazy(() => import("./toys/CameraSim").then((m) => m.CameraSim)) },
  "reaction": { title: "A reaction-time test", show: lazy(() => import("./toys/SportLab").then((m) => m.Reaction)) },
  "pace": { title: "A pace calculator", show: lazy(() => import("./toys/SportLab").then((m) => m.Pace)) },
};

export function Demo({ source }: { source: string }) {
  const name = source.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const demo = DEMOS[name];
  if (!demo) return <p className="nb-wait">There is no demo called “{name}”. The ones there are: {Object.keys(DEMOS).join(", ")}.</p>;
  const Show = demo.show;
  return (
    <div className={`nb-demo ${demo.wrap ?? ""}`} data-demo={name}>
      <Show />
    </div>
  );
}
