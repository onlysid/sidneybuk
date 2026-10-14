"use client";

// The last resort: shown if the frame around every page (the menu, the bar at the bottom) is what broke.
export default function GlobalBroken({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#17121c", color: "#f3eef2", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 560, padding: 24 }}>
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7 }}>sidneyb.uk · something broke</p>
          <h1 style={{ fontSize: 28, margin: "8px 0 14px" }}>The site could not be drawn.</h1>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", background: "rgba(255,255,255,.06)", padding: 14, borderRadius: 12, fontSize: 13 }}>{error.message || "Unknown error"}{error.digest ? `\n(reference ${error.digest})` : ""}</pre>
          <button type="button" onClick={reset} style={{ marginTop: 14, padding: "10px 18px", borderRadius: 999, border: 0, background: "#dcb3cf", color: "#201a26", fontWeight: 600, cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
