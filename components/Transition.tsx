"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";

const Go = createContext<(href: string) => void>(() => {});
export const useGo = () => useContext(Go);

const LEAVE = 170; // ms the old page takes to fade before the route changes

// Fades the old page out, changes route, and lets the new page animate in (see .page in globals.css).
export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const timer = useRef(0);
  const first = useRef(true);

  // The new page has rendered once the pathname changes.
  useEffect(() => {
    delete document.documentElement.dataset.leaving;
    // Start every new page at the top.
    if (first.current) first.current = false;
    else window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  const go = useCallback(
    (href: string) => {
      if (href === pathname) return window.scrollTo({ top: 0, behavior: "smooth" });
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return router.push(href);
      const root = document.documentElement;
      root.dataset.leaving = "on";
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        router.push(href);
        // If nothing has happened after a moment (something else got in the way), ask once more; and never
        // leave the page hidden if it still stalls.
        timer.current = window.setTimeout(() => {
          if (window.location.pathname === pathname) router.push(href);
          timer.current = window.setTimeout(() => delete root.dataset.leaving, 1200);
        }, 900);
      }, LEAVE);
    },
    [pathname, router],
  );

  return <Go.Provider value={go}>{children}</Go.Provider>;
}

export function TLink({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; ref?: React.Ref<HTMLAnchorElement> }) {
  const go = useGo();
  return (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        rest.onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        go(href);
      }}
    >
      {children}
    </a>
  );
}
