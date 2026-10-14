"use client";

import useSWR from "swr";

// Things that change while a page is open (what is playing, the sport numbers) are asked for with SWR: shown at once from what was last known, asked…
const ask = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

// `every` is seconds between checks.
export function useLive<T>(url: string | null, { every = 60, remember = false }: { every?: number; remember?: boolean } = {}) {
  const { data, error, isLoading, mutate } = useSWR<T>(url, ask, {
    refreshInterval: every * 1000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    keepPreviousData: true,
    dedupingInterval: 5000,
    errorRetryCount: 3,
    fallbackData: remember && url ? recall<T>(url) : undefined,
    revalidateOnMount: true,
    onSuccess: (value) => remember && url && keep(url, value),
  });
  return { data: data ?? null, failed: !!error && !data, loading: isLoading && !data, again: mutate };
}

function recall<T>(url: string): T | undefined {
  try {
    const saved = window.localStorage.getItem(`live:${url}`);
    return saved ? (JSON.parse(saved) as T) : undefined;
  } catch {
    return undefined;
  }
}
function keep(url: string, value: unknown) {
  try {
    window.localStorage.setItem(`live:${url}`, JSON.stringify(value));
  } catch {}
}
