"use client";

import { useEffect, useState } from "react";

// Makes the site installable as an app.
type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function ServiceWorker() {
  useEffect(() => {
    // Not while developing: a kept copy of a page being worked on only gets in the way.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || !/^https?:$/.test(window.location.protocol)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

export function InstallButton() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [ios, setIos] = useState(false);
  const [how, setHow] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    const ready = (e: Event) => {
      e.preventDefault();
      setPrompt(e as Prompt);
    };
    const done = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    // iPhones and iPads (an iPad says it is a Mac, but has a touch screen).
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  if (!prompt && !ios) return null;
  return (
    <span className="install">
      <button
        type="button"
        onClick={async () => {
          if (!prompt) return setHow(!how);
          await prompt.prompt();
          await prompt.userChoice.catch(() => null);
          setPrompt(null);
        }}
        aria-expanded={prompt ? undefined : how}
      >
        Install app
      </button>
      {how && !prompt && (
        <span className="install-how" role="status">
In Safari: Share, then <em>Add to Home Screen</em>.
        </span>
      )}
    </span>
  );
}
