"use client";

import { useEffect, useState } from "react";

// The two PDF buttons. In a browser tab they open the PDF in a new tab. In the installed app there is no tab
// to come back from, so the file is handed to the share sheet (AirDrop, Save to Files, Mail…) instead, and
// failing that, downloaded.
export function CvGet({ name }: { name: string }) {
  const [app, setApp] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    setApp(window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
  }, []);
  const get = async (theme: "light" | "dark") => {
    const url = `/cv/pdf?theme=${theme}`;
    if (!app) return window.open(url, "_blank", "noopener");
    setBusy(theme);
    try {
      const blob = await fetch(url, { cache: "no-store" }).then((r) => r.blob());
      const file = new File([blob], `${name} CV${theme === "dark" ? " (dark)" : ""}.pdf`, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `${name} – CV` });
      else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      }
    } catch {
      // The share sheet was dismissed, or could not open: nothing to do.
    }
    setBusy(null);
  };
  return (
    <div className="cv-get">
      <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => get("light")}>
        {busy === "light" ? "Getting it…" : app ? "Share the PDF, light" : "PDF, light"}
      </button>
      <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => get("dark")}>
        {busy === "dark" ? "Getting it…" : app ? "Share the PDF, dark" : "PDF, dark"}
      </button>
    </div>
  );
}
