"use client";

import { useEffect, useState } from "react";

// Types each word, holds, deletes, then moves to the next. The underscore is the one from the logo.
export function Typed({ words }: { words: readonly string[] }) {
  const [index, setIndex] = useState(0);
  const [length, setLength] = useState(words[0].length);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const word = words[index];
    let delay = deleting ? 38 : 85;
    if (!deleting && length === word.length) delay = 1700;
    if (deleting && length === 0) delay = 260;

    const timer = window.setTimeout(() => {
      if (!deleting && length === word.length) setDeleting(true);
      else if (deleting && length === 0) {
        setDeleting(false);
        setIndex((index + 1) % words.length);
      } else setLength(length + (deleting ? -1 : 1));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [words, index, length, deleting]);

  return (
    <p className="typed">
      <span className="prompt" aria-hidden="true">
        &gt;
      </span>
      <span className="sr-only">{words.join(", ")}</span>
      <span className="word" aria-hidden="true">
        {words[index].slice(0, length)}
      </span>
      <span className="cursor" aria-hidden="true" />
    </p>
  );
}
