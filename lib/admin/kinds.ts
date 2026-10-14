import type { Content } from "../content";

// The kinds of thing stored as entries in the database, and which list on the site each one fills.
export const KINDS = {
  post: { list: "posts", byDate: true },
  book: { list: "books", byDate: false },
  piece: { list: "repertoire", byDate: false },
  dose: { list: "doses", byDate: true },
  project: { list: "projects", byDate: true },
  place: { list: "places", byDate: false },
  wish: { list: "wishlist", byDate: false },
  subject: { list: "subjects", byDate: false },
  topic: { list: "topics", byDate: false },
  note: { list: "notes", byDate: true },
  pb: { list: "pbs", byDate: false },
  goal: { list: "goals", byDate: false },
  lift: { list: "lifts", byDate: false },
  change: { list: "changes", byDate: true },
} as const satisfies Record<string, { list: Exclude<keyof Content, "settings">; byDate: boolean }>;
export type Kind = keyof typeof KINDS;
export const isKind = (k: string): k is Kind => k in KINDS;

// One stored entry, as the admin area sees it.
export type Entry = { id: string; kind: Kind; slug: string; title: string; data: Record<string, unknown>; published: boolean; position: number; updatedAt: string };

export const slugify = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
