"use client";

import { useRef, useState } from "react";
import { copyText } from "@/lib/copy";

// The address plus a copy button that shows the copy happening: the letters ripple, the button fills, the clipboard fades out, a tick draws in its…
export function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(0);
  const mail = useRef<HTMLAnchorElement>(null);
  const timer = useRef(0);

  const copy = async () => {
    if (!(await copyText(email))) {
      // Clipboard refused: select the address so it can be copied by hand.
      const range = document.createRange();
      if (mail.current) range.selectNodeContents(mail.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
    setCopied((c) => c + 1);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(0), 2200);
  };

  return (
    <div className="mailrow" data-done={copied > 0}>
      <a className="mail" ref={mail} href={`mailto:${email}`} aria-label={email}>
        <span key={copied} aria-hidden="true">
          {[...email].map((ch, n) => (
            <i key={n} style={{ ["--i" as string]: n }}>
              {ch}
            </i>
          ))}
        </span>
      </a>
      <button type="button" className="copy glass" data-done={copied > 0} onClick={copy} aria-live="polite">
        <span className="copy-fill" aria-hidden="true" />
        <span className="copy-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <g className="clip">
              <rect x="8" y="8" width="11" height="12" rx="2.5" />
              <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-6A2.5 2.5 0 0 0 5 6.5v7A2.5 2.5 0 0 0 7.5 16H8" />
            </g>
            <path className="copy-tick" d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
          </svg>
        </span>
        <span className="copy-label">
          <span>Copy address</span>
          <span>Copied</span>
        </span>
        {copied > 0 && (
          <span key={copied} className="copy-sparks" aria-hidden="true">
            {Array.from({ length: 8 }, (_, n) => (
              <i key={n} style={{ ["--a" as string]: `${n * 45 + 20}deg` }} />
            ))}
          </span>
        )}
      </button>
    </div>
  );
}
