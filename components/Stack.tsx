"use client";

import { useEffect, useState } from "react";
import { stack } from "@/lib/stack";

// "The stack", drawn as one: a tower of slabs seen from a corner, the foundations at the bottom.
export function Stack() {
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);

  // Until someone touches it, it steps through the layers by itself.
  useEffect(() => {
    if (touched || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setActive((a) => (a + 1) % stack.length), 3200);
    return () => window.clearInterval(t);
  }, [touched]);
  const pick = (n: number) => {
    setTouched(true);
    setActive(n);
  };
  const layer = stack[active];

  return (
    <>
      <div className="section-head">
        <h2>What I build with</h2>
        <span className="mono">The stack, as a stack</span>
      </div>
      <div className="tower-wrap glass">
        <div className="tower" data-nowrap role="tablist" aria-label="Layers of the stack" style={{ ["--layers" as string]: stack.length }}>
          {stack.map((g, n) => (
            <button
              key={g.group}
              type="button"
              role="tab"
              aria-selected={n === active}
              className="slab"
              data-above={n < active}
              style={{ ["--n" as string]: n, ["--lift" as string]: n < active ? 1 : 0 }}
              onClick={() => pick(n)}
              onFocus={() => pick(n)}
            >
              <span className="slab-face">
                <b>{g.group}</b>
                <small>{String(g.items.length).padStart(2, "0")}</small>
                <i className="slab-dots" aria-hidden="true">
                  {g.items.map((item) => (
                    <u key={item} />
                  ))}
                </i>
              </span>
            </button>
          ))}
        </div>
        <div className="tower-out" role="tabpanel" aria-live="polite">
          <span className="mono">
            Layer {active + 1} of {stack.length}
          </span>
          <h3 key={layer.group}>{layer.group}</h3>
          <div className="stack-chips" key={`c${active}`}>
            {layer.items.map((item, n) => (
              <span key={item} className="stack-chip" style={{ ["--i" as string]: n }}>
                {item}
              </span>
            ))}
          </div>
          <div className="tower-steps" data-nowrap>
            {stack.map((g, n) => (
              <button key={g.group} type="button" aria-label={g.group} aria-pressed={n === active} onClick={() => pick(n)}>
                <i />
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
