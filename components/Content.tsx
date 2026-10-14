"use client";

import { createContext, useContext, useMemo } from "react";
import { seed, type Content } from "@/lib/content";
import { site as identity } from "@/lib/site";

const Ctx = createContext<Content>(seed);

// Wraps the whole site.
export function ContentProvider({ value, children }: { value: Content; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useContent = () => useContext(Ctx);

// Who I am (fixed, from lib/site.ts) together with the settings that change (from the admin area).
export function useSite() {
  const { settings } = useContent();
  return useMemo(() => ({ ...identity, ...settings }), [settings]);
}
