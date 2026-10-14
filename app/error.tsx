"use client";

import { useEffect } from "react";
import { Lost } from "@/components/Lost";

// Shown in place of a page that broke while it was being drawn, so a fault is never just a blank screen.
export default function Broken({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return <Lost code={500} error={`${error.message || "Unknown error"}${error.digest ? `\n(reference ${error.digest})` : ""}`} reset={reset} />;
}
