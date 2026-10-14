"use client";

import { Pill } from "@/components/Pill";
import { useContent } from "@/components/Content";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { monthYear, searchBooks, type Book } from "@/lib/books";
import { site } from "@/lib/site";
import { Tilt } from "./Tilt";
import { TLink } from "./Transition";

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
// Cloth colours for books without a cover picture, and for every spine: [cloth, lettering, foil].
const CLOTH = [
  ["#ddb3cb", "#201a26", "#684780"],
  ["#a878aa", "#201a26", "#f3eef2"],
  ["#684780", "#f3eef2", "#ddb3cb"],
  ["#3a2f45", "#f3eef2", "#ddb3cb"],
  ["#f3eef2", "#201a26", "#a878aa"],
  ["#8a66a3", "#f3eef2", "#201a26"],
  ["#4d3a2e", "#f3e6d8", "#d9a15c"],
  ["#2f4a4a", "#e8f1ee", "#d9a15c"],
  ["#7a2e3b", "#f6e9e6", "#e6c27a"],
];
const cloth = (b: Book) => CLOTH[hash(b.title) % CLOTH.length];
const LABEL = { reading: "Reading now", read: "Read", next: "Up next" };

export function Stars({ rating, small = false }: { rating: number; small?: boolean }) {
  return (
    <span className={small ? "stars small" : "stars"} role="img" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" data-on={n <= rating} style={{ ["--i" as string]: n }} aria-hidden="true">
          <path d="M12 3.200l2.700 5.600 6.100.800-4.500 4.300 1.100 6.100L12 17.100 6.600 20l1.100-6.100L3.200 9.600l6.100-.800z" />
        </svg>
      ))}
    </span>
  );
}

// A book's front cover: the picture uploaded for it, or the published cover looked up by ISBN, or, failing both, one drawn from the title in the same cloth as…
export function Cover({ book, eager = false }: { book: Book; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = book.cover ?? (book.isbn ? `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg?default=false` : "");
  const [bg, ink, foil] = cloth(book);
  return (
    <span className="bk-cover" style={{ ["--cloth" as string]: bg, ["--ink" as string]: ink, ["--foil" as string]: foil }}>
      <span className="bk-drawn" aria-hidden={!!src && !failed}>
        <i />
        <b>{book.title}</b>
        <small>{book.author}</small>
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && !failed && <img src={src} alt={`Cover of ${book.title}`} loading={eager ? "eager" : "lazy"} onError={() => setFailed(true)} />}
    </span>
  );
}

type Grouping = "year" | "genre" | "status";
function groupBooks(list: Book[], by: Grouping): [string, Book[]][] {
  const map = new Map<string, Book[]>();
  const key = (b: Book) => (by === "genre" ? b.genre : by === "status" ? LABEL[b.status] : b.status === "reading" ? "Reading now" : b.status === "next" ? "Up next" : (b.finished?.slice(0, 4) ?? "Some time ago"));
  list.forEach((b) => map.set(key(b), [...(map.get(key(b)) ?? []), b]));
  const rank = (name: string) => (name === "Reading now" ? "9999" : name === "Up next" ? "0000" : name === "Read" ? "5000" : name);
  const groups = [...map.entries()];
  groups.sort(([a], [b]) => (by === "genre" ? a.localeCompare(b) : rank(b).localeCompare(rank(a))));
  groups.forEach(([, g]) => g.sort((a, b) => (b.finished ?? "").localeCompare(a.finished ?? "")));
  return groups;
}

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

// One shelf: a row of spines on a plank. Tap a spine and the book comes out underneath.
function Shelf({ name, list, open, onOpen, order }: { name: string; list: Book[]; open: string | null; onOpen: (slug: string | null) => void; order: number }) {
  const out = list.find((b) => b.slug === open);
  return (
    <section className="bk-shelf" data-out={!!out} style={{ flexGrow: list.length, order }}>
      <header>
        <h3>{name}</h3>
        <span className="mono">
          {list.length} {list.length === 1 ? "book" : "books"}
        </span>
      </header>
      <div className="bk-row" role="list" data-nowrap>
        {list.map((b, n) => {
          const h = hash(b.title);
          const [bg, ink, foil] = cloth(b);
          // Thickness follows the page count; height varies a little so the row looks like a real shelf.
          const width = Math.round(Math.min(64, Math.max(30, (b.pages ?? 300) / 9)));
          return (
            <button
              key={b.slug}
              type="button"
              role="listitem"
              className="bk-spine"
              data-open={open === b.slug}
              data-status={b.status}
              onClick={() => onOpen(open === b.slug ? null : b.slug)}
              aria-expanded={open === b.slug}
              aria-label={`${b.title} by ${b.author}. ${LABEL[b.status]}.`}
              style={{ ["--i" as string]: n, ["--h" as string]: `${82 + (h % 17)}%`, ["--w" as string]: `${width}px`, ["--cloth" as string]: bg, ["--ink" as string]: ink, ["--foil" as string]: foil }}
            >
              <span className="bk-spine-title">{b.title}</span>
              <span className="bk-spine-author">{b.author.split(" ").pop()}</span>
            </button>
          );
        })}
      </div>
      <div className="bk-plank" aria-hidden="true" />
    </section>
  );
}

// The book that has been taken off a shelf, laid out underneath the row of shelves it came from.
function BookOut({ out, order }: { out: Book; order: number }) {
  return (
    <div className="bk-out" key={out.slug} style={{ order }}>
      <TLink href={`/reading/${out.slug}`} className="bk-out-cover" aria-label={`Open ${out.title}`}>
        <Cover book={out} eager />
      </TLink>
      <div className="bk-out-text">
        <span className="mono">
          {out.genre} · {out.status === "read" && out.finished ? `finished ${monthYear(out.finished)}` : LABEL[out.status]}
        </span>
        <h4>{out.title}</h4>
        <p className="bk-by">{out.author}</p>
        {out.rating && <Stars rating={out.rating} small />}
        {out.status === "reading" && out.progress !== undefined && (
          <span className="bk-progress" role="img" aria-label={`${out.progress} percent read`}>
            <i style={{ width: `${out.progress}%` }} />
          </span>
        )}
        {out.review && <p>{out.review}</p>}
        <TLink href={`/reading/${out.slug}`} className="btn btn-ghost small">
          {out.thoughts ? "Read what I thought" : "Open the book"} →
        </TLink>
      </div>
    </div>
  );
}

// A box for telling me what to read next. It opens an email to me in the visitor's own mail app.
function Suggest() {
  const { books } = useContent();
  const [title, setTitle] = useState("");
  const what = title.trim();
  const mail = `mailto:${site.email}?subject=${encodeURIComponent(what ? `You should read ${what}` : "A book you should read")}&body=${encodeURIComponent(what ? `Hi Sidney,\n\nYou should read ${what}, because ` : "Hi Sidney,\n\nYou should read ")}`;
  return (
    <div className="bk-suggest glass">
      <div>
        <h3>What should I read next?</h3>
        <p>Name a book and tell me why. It opens an email to me in your own mail app.</p>
      </div>
      <div className="bk-suggest-row">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A book" aria-label="The book you suggest" maxLength={120} />
        <a className="btn btn-primary small" href={mail}>
          Suggest it
        </a>
      </div>
    </div>
  );
}

// The whole library: what I am reading now, a search box, and the books grouped on shelves or laid out as covers.
export function Library() {
  const { books, settings } = useContent();
  const yearlyGoal = settings.yearlyGoal;
  const [query, setQuery] = useState("");
  const [by, setBy] = useState<Grouping>("year");
  const [view, setView] = useState<"spines" | "covers">("spines");
  const [open, setOpen] = useState<string | null>(null);
  const year = String(new Date().getFullYear());
  const read = books.filter((b) => b.status === "read");
  const doneThisYear = read.filter((b) => b.finished?.startsWith(year)).length;
  const rated = read.filter((b) => b.rating);
  const current = books.find((b) => b.status === "reading");
  const found = useMemo(() => searchBooks(books, query), [books, query]);
  const groups = useMemo(() => groupBooks(found, by), [found, by]);
  // The opened book goes under the last shelf of the row its own shelf is in.
  const bookcase = useRef<HTMLDivElement>(null);
  const taken = found.find((b) => b.slug === open);
  const home = groups.findIndex(([, list]) => list.some((b) => b.slug === open));
  const [after, setAfter] = useState(0);
  useIso(() => {
    if (home < 0) return;
    const place = () => {
      const shelves = [...(bookcase.current?.querySelectorAll<HTMLElement>(".bk-shelf") ?? [])];
      // The rows are read as they are without the opened book, which would otherwise split one in two.
      const panel = bookcase.current?.querySelector<HTMLElement>(":scope > .bk-out");
      if (panel) panel.style.display = "none";
      const top = shelves[home]?.offsetTop;
      let last = home;
      shelves.forEach((el, n) => {
        if (n > last && Math.abs(el.offsetTop - top) < 4) last = n;
      });
      if (panel) panel.style.display = "";
      setAfter(last);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [home, groups, open]);

  return (
    <div className="bk">
      <div className="bk-top">
        {current && (
          <TLink href={`/reading/${current.slug}`} className="bk-now glass">
            <Cover book={current} eager />
            <span className="bk-now-text">
              <span className="mono">Reading now</span>
              <b>{current.title}</b>
              <span>{current.author}</span>
              {current.progress !== undefined && (
                <>
                  <span className="bk-progress" role="img" aria-label={`${current.progress} percent read`}>
                    <i style={{ width: `${current.progress}%` }} />
                  </span>
                  <span className="mono">
                    {current.progress}% {current.pages ? `· page ${Math.round((current.pages * current.progress) / 100)} of ${current.pages}` : ""}
                  </span>
                </>
              )}
            </span>
          </TLink>
        )}
        <div className="bk-stats glass">
          <div className="bk-goal" role="img" aria-label={`${doneThisYear} of ${yearlyGoal} books finished in ${year}`}>
            <span className="mono">
              {year} goal: {doneThisYear} of {yearlyGoal}
            </span>
            <span className="goal-bar">
              {Array.from({ length: yearlyGoal }, (_, n) => (
                <i key={n} data-on={n < doneThisYear} style={{ ["--i" as string]: n }} />
              ))}
            </span>
          </div>
          <dl>
            <div>
              <dd>{read.length}</dd>
              <dt className="mono">read</dt>
            </div>
            <div>
              <dd>{read.reduce((a, b) => a + (b.pages ?? 0), 0).toLocaleString("en-GB")}</dd>
              <dt className="mono">pages</dt>
            </div>
            <div>
              <dd>{rated.length ? (rated.reduce((a, b) => a + (b.rating ?? 0), 0) / rated.length).toFixed(1) : "–"}</dd>
              <dt className="mono">average rating</dt>
            </div>
          </dl>
        </div>
      </div>

      <div className="bk-tools">
        <label className="bk-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.500" />
            <path d="M16 16l4.500 4.500" />
          </svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title, author, genre or year" aria-label="Search the library" />
        </label>
        <div className="seg" role="group" aria-label="Group by">
          <Pill />
          {(["year", "genre", "status"] as const).map((g) => (
            <button key={g} type="button" aria-pressed={by === g} onClick={() => setBy(g)}>
              By {g}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Show as">
          <Pill />
          {(["spines", "covers"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
              {v === "spines" ? "Spines" : "Covers"}
            </button>
          ))}
        </div>
      </div>
      {query && (
        <p className="mono bk-count" aria-live="polite">
          {found.length} of {books.length} books match “{query}”
        </p>
      )}

      {found.length === 0 ? (
        <p className="mu-empty glass">Nothing on the shelves matches that.</p>
      ) : view === "spines" ? (
        <div className="bk-case" ref={bookcase}>
          {groups.map(([name, list], n) => (
            <Shelf key={name} name={name} list={list} open={open} onOpen={setOpen} order={n * 2} />
          ))}
          {taken && <BookOut out={taken} order={after * 2 + 1} />}
        </div>
      ) : (
        <div className="bk-groups">
          {groups.map(([name, list]) => (
            <section key={name}>
              <header className="bk-group-head">
                <h3>{name}</h3>
                <span className="mono">
                  {list.length} {list.length === 1 ? "book" : "books"}
                </span>
              </header>
              <div className="bk-covers">
                {list.map((b) => (
                  <Tilt key={b.slug} max={7} className="bk-tilt">
                    <TLink href={`/reading/${b.slug}`} className="bk-tile">
                      <Cover book={b} />
                      <b>{b.title}</b>
                      <span>{b.author}</span>
                      {b.rating ? <Stars rating={b.rating} small /> : <span className="mono">{LABEL[b.status]}</span>}
                    </TLink>
                  </Tilt>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <Suggest />
    </div>
  );
}
