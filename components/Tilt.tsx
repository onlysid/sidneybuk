"use client";

import { useRef } from "react";

// Leans its child toward the pointer, like a card held in the hand.
export function Tilt({ children, className = "", max = 9 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`tilt ${className}`}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        ref.current.style.setProperty("--ry", `${px * max}deg`);
        ref.current.style.setProperty("--rx", `${-py * max}deg`);
      }}
      onPointerLeave={() => {
        ref.current?.style.setProperty("--ry", "0deg");
        ref.current?.style.setProperty("--rx", "0deg");
      }}
    >
      {children}
    </div>
  );
}
