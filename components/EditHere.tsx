"use client";

import { usePathname } from "next/navigation";
import { useLive } from "@/lib/live";
import { TLink } from "./Transition";

// Only I ever see this: when I am signed in to the admin area, every page carries a small button that goes straight to the place where that page is…
type Way = { label: string; href: string };

function waysFor(pathname: string): Way[] {
  const p = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const find = (kinds: string, slug: string) => `/admin/find/${kinds}/${encodeURIComponent(slug)}`;
  const one = (label: string, href: string): Way[] => [{ label, href }];
  if (!p.length) return one("Admin", "/admin");
  switch (p[0]) {
    case "blog":
      return p[1] ? one("Edit this post", find("post", p[1])) : one("Posts", "/admin/post");
    case "reading":
      return p[1] ? one("Edit this book", find("book", p[1])) : one("Books", "/admin/book");
    case "music":
      if (p[1] === "pieces" && p[2]) return one("Edit this piece", find("piece", p[2]));
      if (p[1] === "doses" && p[2]) return one("Edit this dose", find("dose", p[2]));
      return [{ label: "Pieces", href: "/admin/piece" }, { label: "Doses", href: "/admin/dose" }];
    case "film":
      return p[1] === "projects" && p[2] ? one("Edit this project", find("project", p[2])) : one("Projects", "/admin/project");
    case "travel":
      return p[1] ? one("Edit this place", find("place", p[1])) : [{ label: "Places", href: "/admin/place" }, { label: "Wish list", href: "/admin/wish" }];
    case "learning":
      if (p[2]) return [{ label: "Edit this page", href: find("topic,note", p[2]) }, { label: "Cards", href: `/admin/cards/${encodeURIComponent(p[2])}` }];
      if (p[1]) return [{ label: "Edit this subject", href: find("subject", p[1]) }, { label: "New note", href: "/admin/note/new" }];
      return [{ label: "Notes", href: "/admin/note" }, { label: "Cards", href: "/admin/cards" }];
    case "sport":
      if (p[1] === "activities" && p[2]) return one("Write this up", `/admin/activities/${p[2]}`);
      if (p[1] === "gym") return one("Gym today", "/admin/gym");
      return one("Training", "/admin/activities");
    case "changelog":
      return one("Changelog", "/admin/change");
    case "contact":
    case "privacy":
      return one("Settings", "/admin/settings");
    default:
      return one("Admin", "/admin");
  }
}

// The pencil is a small blob of its own beside the menu at the top of every page, as if it had budded off it.
export function EditHere() {
  const pathname = usePathname();
  const { data } = useLive<{ signedIn: boolean }>("/api/admin/session", { every: 300 });
  if (!data?.signedIn || pathname.startsWith("/admin")) return null;
  const way = waysFor(pathname)[0];
  return (
    <TLink href={way.href} className="dock-blob glass" aria-label={way.label} title={way.label}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20h4L19 9l-4-4L4 16v4z" />
        <path d="M13.5 6.5l4 4" />
      </svg>
    </TLink>
  );
}
