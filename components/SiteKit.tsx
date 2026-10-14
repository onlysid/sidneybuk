"use client";

import { copyText } from "@/lib/copy";
import { useState } from "react";
import { assets } from "@/lib/assets";
import { Mark } from "./Mark";
import { Strings } from "./Strings";

const COLOURS = [
  ["Rose mauve", "#DDB3CB"],
  ["Mauve", "#A878AA"],
  ["Plum", "#684780"],
  ["Ink", "#201A26"],
  ["Pale", "#F3EEF2"],
];

// The parts this site is made from, live rather than pictured: its colours, its marks, its type and its strings.
export function SiteKit() {
  const [copied, setCopied] = useState("");
  const copy = async (hex: string) => {
    // If the clipboard is refused, the value is still on screen.
    if (!(await copyText(hex))) return;
    setCopied(hex);
    window.setTimeout(() => setCopied(""), 1400);
  };
  return (
    <div className="kit">
      <div className="kit-card glass">
        <h3>Colour</h3>
        <div className="swatches">
          {COLOURS.map(([name, hex]) => (
            <button key={hex} type="button" className="swatch" onClick={() => copy(hex)} aria-label={`${name}, ${hex}. Copy.`}>
              <i style={{ background: hex }} />
              <b>{name}</b>
              <span>{copied === hex ? "copied" : hex}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="kit-card glass">
        <h3>The mark</h3>
        <div className="marks">
          <span style={{ background: "#201a26" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assets.logo} alt="The logo in colour" />
          </span>
          <span style={{ background: "#684780" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assets.logoWhite} alt="The logo in white" />
          </span>
          <span style={{ background: "#f3eef2" }}>
            <Mark id="kit" />
          </span>
        </div>
        <p className="mono">A teardrop tile, three strings for an S, and an underscore.</p>
      </div>
      <div className="kit-card glass">
        <h3>Type</h3>
        <div className="types">
          <div>
            <b style={{ fontFamily: "var(--display)" }}>Bricolage Grotesque</b>
            <span className="mono">Headings</span>
          </div>
          <div>
            <b style={{ fontFamily: "var(--body)" }}>Instrument Sans</b>
            <span className="mono">Reading</span>
          </div>
          <div>
            <b style={{ fontFamily: "var(--mono)", letterSpacing: 0 }}>JetBrains Mono</b>
            <span className="mono">Labels and code</span>
          </div>
        </div>
      </div>
      <div className="kit-card glass wide">
        <h3>The strings from the logo, playable</h3>
        <Strings />
      </div>
    </div>
  );
}
