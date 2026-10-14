"use client";

import { useContent } from "@/components/Content";
import { Cover, Stars } from "@/components/Books";
import { Footer } from "@/components/Footer";
import { TLink } from "@/components/Transition";
import { monthYear, type Book } from "@/lib/books";

const d = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as React.CSSProperties;
const LABEL = { reading: "Reading now", read: "Read", next: "Up next" };

// /reading/<slug>: one book, and everything I have to say about it.
export function BookView({ book }: { book: Book }) {
  const { books } = useContent();
  const index = books.findIndex((x) => x.slug === book.slug);
  const before = books[index - 1], after = books[index + 1];
  const find = encodeURIComponent(`${book.title} ${book.author}`);
  const facts: [string, string | undefined][] = [
    ["Author", book.author],
    ["Genre", book.genre],
    ["First published", book.published ? String(book.published) : undefined],
    ["Pages", book.pages ? String(book.pages) : undefined],
    ["Started", book.started ? monthYear(book.started) : undefined],
    ["Finished", book.finished ? monthYear(book.finished) : undefined],
  ];
  return (
    <main className="page" data-kind="reading">
      <article className="wrap work bk-page">
        <p className="mono rise">
          <TLink href="/">Home</TLink> / <TLink href="/reading">Reading</TLink> / {book.title}
        </p>
        <div className="bk-hero">
          <div className="bk-hero-cover rise" style={d(60)}>
            <Cover book={book} eager />
          </div>
          <div className="bk-hero-text">
            <h1 className="rise" style={d(80)}>
              <span className="name">{book.title}</span>
            </h1>
            <p className="lede rise" style={d(150)}>
              {book.author}
            </p>
            <div className="work-actions rise" style={d(210)}>
              <span className="rep-stage" data-stage={book.status === "read" ? "Read" : "Learning"}>
                {LABEL[book.status]}
              </span>
              <span className="post-tag">{book.genre}</span>
              {book.sample && <span className="post-tag sample">sample entry</span>}
            </div>
            {book.rating && (
              <div className="rise" style={d(260)}>
                <Stars rating={book.rating} />
              </div>
            )}
            {book.status === "reading" && book.progress !== undefined && (
              <div className="bk-hero-progress rise" style={d(260)}>
                <span className="bk-progress" role="img" aria-label={`${book.progress} percent read`}>
                  <i style={{ width: `${book.progress}%` }} />
                </span>
                <span className="mono">{book.progress}% of the way through</span>
              </div>
            )}
            {book.review && (
              <p className="bk-short rise" style={d(300)}>
                {book.review}
              </p>
            )}
          </div>
        </div>

        <div className="work-cols rise" style={d(340)}>
          <div className="work-body">
            {book.thoughts ? (
              book.thoughts.map((block, n) => (block.startsWith("## ") ? <h2 key={n} className="mu-h">{block.slice(3)}</h2> : <p key={n}>{block}</p>))
            ) : (
              <p className="bk-none">{book.status === "next" ? "Not started yet. It is on the pile." : "Nothing longer written about this one yet."}</p>
            )}
            {book.takeaways && (
              <>
                <h2 className="mu-h">What I took from it</h2>
                <ul className="lr-list">
                  {book.takeaways.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <dl className="work-facts glass">
            {facts.map(
              ([label, value]) =>
                value && (
                  <div key={label}>
                    <dt className="mono">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ),
            )}
            <div className="bk-find">
              <dt className="mono">Find it</dt>
              <dd>
                <a href={book.isbn ? `https://openlibrary.org/isbn/${book.isbn}` : `https://openlibrary.org/search?q=${find}`} target="_blank" rel="noreferrer">
                  Open Library
                </a>
                <a href={`https://www.goodreads.com/search?q=${book.isbn ?? find}`} target="_blank" rel="noreferrer">
                  Goodreads
                </a>
              </dd>
            </div>
          </dl>
        </div>

        <nav className="post-nav" aria-label="Other books">
          {before ? (
            <TLink href={`/reading/${before.slug}`} className="btn btn-glass glass">
              ← {before.title}
            </TLink>
          ) : (
            <span />
          )}
          {after ? (
            <TLink href={`/reading/${after.slug}`} className="btn btn-glass glass">
              {after.title} →
            </TLink>
          ) : (
            <span />
          )}
        </nav>
      </article>
      <Footer />
    </main>
  );
}
