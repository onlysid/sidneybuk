"use client";

import { useEffect, useState } from "react";
import { chime, onSound, setSound, soundOn } from "@/lib/audio";
import { currentTheme, onTheme, toggleTheme, type Theme } from "@/lib/theme";

export function useTheme() {
  const [theme, set] = useState<Theme>("dark");
  useEffect(() => {
    set(currentTheme());
    const off = onTheme(set);
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => set(currentTheme());
    media.addEventListener("change", sync);
    return () => {
      off();
      media.removeEventListener("change", sync);
    };
  }, []);
  return theme;
}
export function useSound() {
  const [on, set] = useState(false);
  useEffect(() => {
    set(soundOn());
    return onSound(set);
  }, []);
  return on;
}
const flipSound = () => {
  const next = !soundOn();
  setSound(next);
  if (next) chime();
};
const centre = (el: Element) => {
  const b = el.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
};

// A sun that turns into a moon: the rays pull in and a bite is taken out of the disc.
function SunMoon({ theme }: { theme: Theme }) {
  return (
    <svg viewBox="0 0 24 24" className="sunmoon" data-theme-is={theme} aria-hidden="true">
      <mask id="sm-bite">
        <rect width="24" height="24" fill="#fff" />
        <circle className="sm-bite" cx="24" cy="4" r="6.5" fill="#000" />
      </mask>
      <circle className="sm-disc" cx="12" cy="12" r="4.6" mask="url(#sm-bite)" />
      <g className="sm-rays">
        {Array.from({ length: 8 }, (_, n) => (
          <line key={n} x1="12" y1="2.6" x2="12" y2="4.6" transform={`rotate(${n * 45} 12 12)`} />
        ))}
      </g>
    </svg>
  );
}
// A speaker whose waves draw themselves in when sound is on and collapse to a cross when it is off.
function Speaker({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="speaker" data-on={on} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10v4h3l4 3.5v-11L7 10H4z" />
      <path className="sp-wave w1" d="M15 9.5a3.5 3.5 0 0 1 0 5" pathLength={1} />
      <path className="sp-wave w2" d="M17.5 7a7 7 0 0 1 0 10" pathLength={1} />
      <path className="sp-cross" d="M16 10l4 4M20 10l-4 4" />
    </svg>
  );
}

// The round buttons in the menu bar on larger screens.
export function ThemeButton() {
  const theme = useTheme();
  return (
    <button className="dock-btn dock-extra" type="button" onClick={(e) => toggleTheme(centre(e.currentTarget))} aria-label={theme === "light" ? "Switch to dark" : "Switch to light"}>
      <SunMoon theme={theme} />
    </button>
  );
}
export function SoundButton() {
  const on = useSound();
  return (
    <button className="dock-btn dock-extra" type="button" onClick={flipSound} aria-pressed={on} aria-label={on ? "Turn sound off" : "Turn sound on"}>
      <Speaker on={on} />
    </button>
  );
}

// The labelled switches in the menu on small screens: each says what state it is in.
export function ThemeSwitch() {
  const theme = useTheme();
  return (
    <button type="button" className="switch" role="switch" aria-checked={theme === "dark"} onClick={(e) => toggleTheme(centre(e.currentTarget.querySelector(".switch-knob") ?? e.currentTarget))}>
      <span className="switch-text">
        <small>Theme</small>
        <b key={theme}>{theme === "dark" ? "Dark" : "Light"}</b>
      </span>
      <span className="switch-track sky" data-theme-is={theme} aria-hidden="true">
        <i className="star s1" />
        <i className="star s2" />
        <i className="star s3" />
        <i className="cloud" />
        <span className="switch-knob">
          <SunMoon theme={theme} />
        </span>
      </span>
    </button>
  );
}
export function SoundSwitch() {
  const on = useSound();
  return (
    <button type="button" className="switch" role="switch" aria-checked={on} onClick={flipSound}>
      <span className="switch-text">
        <small>Sound</small>
        <b key={String(on)}>{on ? "On" : "Off"}</b>
      </span>
      <span className="switch-track levels" data-on={on} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((n) => (
          <i key={n} className="level" style={{ ["--i" as string]: n }} />
        ))}
        <span className="switch-knob">
          <Speaker on={on} />
        </span>
      </span>
    </button>
  );
}
