"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

// Everything written in the admin area (posts, books, places, settings) is put into the page by the server.
export function KeepFresh() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    // Not in the admin area: a form being filled in should not have anything move under it.
    if (pathname.startsWith("/admin")) return;
    let last = Date.now();
    const arrived = Date.now();
    // A refresh and a page change at the same moment leave the old page up (the refresh wins), and a click that
    // brings the window to the front does both at once. So a refresh waits a moment, then only goes ahead if
    // no page change has started.
    let wait = 0;
    const again = () => {
      window.clearTimeout(wait);
      wait = window.setTimeout(() => {
        if (document.documentElement.dataset.leaving || Date.now() - arrived < 4000) return;
        if (document.visibilityState !== "visible" || Date.now() - last < 15000) return;
        last = Date.now();
        router.refresh();
      }, 800);
    };
    const timer = window.setInterval(again, 60000);
    document.addEventListener("visibilitychange", again);
    window.addEventListener("focus", again);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(wait);
      document.removeEventListener("visibilitychange", again);
      window.removeEventListener("focus", again);
    };
  }, [router, pathname]);
  return null;
}
