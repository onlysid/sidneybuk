import type { Settings } from "../content";
import type { ActivityLog, Kind as ActivityKind } from "../training";
import type { Entry, Kind } from "./kinds";

// How the admin area talks to the server.
export type KeyGroup = { service: string; about: string; keys: { name: string; set: boolean; from: string; updatedAt: string }[] };
export type AppleMusicStatus = { developerToken: string; hasKey: boolean; connected: boolean; works: boolean | null; status: number; track: { title: string; artist: string } | null; error: string };
export type StravaStatus = { hasApp: boolean; connected: boolean; lastSync?: string; athlete?: string; error?: string; running: boolean; activities: number; detailed: number; hidden: number };
export type AdminActivity = { id: string; sport: string; name: string; start_local: string; distance: number; moving: number; hr?: number; hidden: boolean; log: ActivityLog; kind: ActivityKind; has?: { hr: boolean; cadence: boolean } };
export type Media = { id: string; url: string; name: string; mime: string; size: number; createdAt: string };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Something went wrong (${res.status})`);
  return body as T;
}

export const api = {
  // True only in the in-chat preview, where everything is kept in memory.
  demo: false,
  session: () => call<{ signedIn: boolean; database: boolean; passwordSet: boolean }>("/api/admin/session"),
  signIn: (password: string) => call<{ signedIn: boolean }>("/api/admin/session", { method: "POST", body: JSON.stringify({ password }) }),
  signOut: () => call("/api/admin/session", { method: "DELETE" }),
  list: (kind: Kind) => call<{ entries: Entry[] }>(`/api/admin/entries?kind=${kind}`).then((r) => r.entries),
  get: (id: string) => call<{ entry: Entry }>(`/api/admin/entries/${id}`).then((r) => r.entry),
  save: (kind: Kind, entry: { id?: string; slug: string; data: Record<string, unknown>; published: boolean; position?: number }) =>
    call<{ entry: Entry }>(entry.id ? `/api/admin/entries/${entry.id}` : "/api/admin/entries", { method: entry.id ? "PUT" : "POST", body: JSON.stringify({ kind, ...entry }) }).then((r) => r.entry),
  remove: (id: string) => call(`/api/admin/entries/${id}`, { method: "DELETE" }),
  // Apple Music: how far along it is, and the developer token the Connect button needs.
  appleMusic: () => call<AppleMusicStatus>("/api/admin/apple-music"),
  settings: () => call<{ settings: Settings; keys: KeyGroup[] }>("/api/admin/settings"),
  saveSettings: (body: { settings?: Settings; keys?: Record<string, string> }) => call<{ settings: Settings; keys: KeyGroup[] }>("/api/admin/settings", { method: "PUT", body: JSON.stringify(body) }),
  media: () => call<{ media: Media[] }>("/api/admin/media").then((r) => r.media),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return call<{ media: Media }>("/api/admin/media", { method: "POST", body: form }).then((r) => r.media);
  },
  removeMedia: (id: string) => call(`/api/admin/media?id=${id}`, { method: "DELETE" }),
  strava: () => call<StravaStatus>("/api/admin/strava"),
  stravaDo: (action: "sync" | "full" | "disconnect") => call<{ added?: number; details?: number; status: StravaStatus }>("/api/admin/strava", { method: "POST", body: JSON.stringify({ action }) }),
  // Connecting means leaving for Strava and coming back, so it is an address to go to, not a call.
  stravaConnect: "/api/admin/strava/connect",
  // Every activity with what has been written on it; `kind` narrows the list to runs, gym or padel.
  activities: (q: string, offset: number, kind = "") => call<{ total: number; items: AdminActivity[] }>(`/api/admin/activities?${new URLSearchParams({ q, offset: String(offset), kind })}`),
  activity: (id: string) => call<{ activity: AdminActivity }>(`/api/admin/activities?id=${id}`).then((r) => r.activity),
  hideActivity: (id: string, hidden: boolean) => call("/api/admin/activities", { method: "PUT", body: JSON.stringify({ id, hidden }) }),
  // What I wrote on one: the whole of it, replacing what was there.
  saveLog: (id: string, log: ActivityLog) => call("/api/admin/activities", { method: "PUT", body: JSON.stringify({ id, log }) }),
  // Something Strava never saw.
  addActivity: (input: { date: string; sport: string; name?: string; time: number; km?: number; hr?: number }) => call<{ id: string }>("/api/admin/activities", { method: "POST", body: JSON.stringify(input) }),
  // The old spreadsheet of runs: how many it holds and how many are in already, and bringing them in.
  runLog: () => call<{ spreadsheet: number; byHand: number }>("/api/admin/activities?runlog=1"),
  importRunLog: () => call<{ runs: number; added: number }>("/api/admin/activities", { method: "POST", body: JSON.stringify({ import: "runlog" }) }),
  removeActivity: (id: string) => call(`/api/admin/activities?id=${id}`, { method: "DELETE" }),
};
export type Api = typeof api;
