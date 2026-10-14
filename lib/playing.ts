"use client";

import { useSyncExternalStore } from "react";

// What is sounding on this page that can be controlled: a score being performed, a recording, a video.
export type Playback = {
  id: string;
  title: string;
  sub?: string;
  playing: boolean;
  toggle: () => void;
  seek?: (fraction: number) => void;
  stop: () => void; // stop the sound and let go of the bar
  show?: () => void; // bring the thing that is playing into view
  alive?: () => boolean; // false once the page it was on has gone
};
export type Progress = { at: number; label: string };

let current: Playback | null = null;
let progress: Progress = { at: 0, label: "" };
const watchers = new Set<() => void>();
const meters = new Set<(p: Progress) => void>();
const tell = () => watchers.forEach((w) => w());

export const playback = {
  set(next: Playback) {
    // Only one thing at a time: whatever was playing before is paused.
    if (current && current.id !== next.id && current.playing) current.toggle();
    current = next;
    tell();
  },
  patch(id: string, part: Partial<Playback>) {
    if (current?.id !== id) return;
    current = { ...current, ...part };
    tell();
  },
  clear(id?: string) {
    if (!current || (id && current.id !== id)) return;
    current = null;
    progress = { at: 0, label: "" };
    tell();
  },
  // Position changes many times a second, so it does not go through React: whoever draws it listens here.
  progress(id: string, at: number, label: string) {
    if (current?.id !== id) return;
    progress = { at: Math.max(0, Math.min(1, at || 0)), label };
    meters.forEach((m) => m(progress));
  },
  meter(fn: (p: Progress) => void) {
    meters.add(fn);
    fn(progress);
    return () => void meters.delete(fn);
  },
  now: () => current,
};

const watch = (fn: () => void) => (watchers.add(fn), () => void watchers.delete(fn));
export const usePlayback = () => useSyncExternalStore(watch, () => current, () => null);
