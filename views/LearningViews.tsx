"use client";

import { Pill } from "@/components/Pill";
import { useMemo, useState } from "react";
import { Deck } from "@/components/Cards";
import { useContent } from "@/components/Content";
import { Footer } from "@/components/Footer";
import { useMore } from "@/components/More";
import { headingsOf, InlineMarkdown, Markdown } from "@/components/Markdown";
import { JumpField, NotebookBar, NotebookNav, Reveal, SubjectArt, Tabs, Toc, useJump } from "@/components/Notebook";
import { Pick } from "@/components/Sport";
import { TLink, useGo } from "@/components/Transition";
import { deckFor, holds, notesIn, type Note, type Resource, type Subject, type Topic } from "@/lib/learning";
import { longDate } from "@/lib/posts";

// The notebook: /learning (everything), /learning/<subject>, and under a subject either a topic or a note.
const d = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as React.CSSProperties;
const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const blank = (slug: string): Subject => ({ slug, title: slug, short: "", now: "", about: "" });

// Notes as rows: date, title, what it is about, where it lives.
function NoteList({ list, showPlace = false, numbered = false }: { list: Note[]; showPlace?: boolean; numbered?: boolean }) {
  const { subjects, topics } = useContent();
  if (!list.length) return <p className="nb-empty">Nothing written here yet.</p>;
  return (
    <Reveal className="nb-notes">
      {list.map((n, k) => {
        const topic = topics.find((t) => t.subject === n.subject && t.slug === n.topic);
        const made = holds(n.md);
        return (
          <TLink key={`${n.subject}/${n.slug}`} href={`/learning/${n.subject}/${n.slug}`} className="nb-note glass">
            {numbered && <span className="nb-note-no mono">{String(k + 1).padStart(2, "0")}</span>}
            <span className="nb-note-main">
              <span className="mono">
                {longDate(n.date)}
                {showPlace && <> · {topic?.title ?? subjects.find((s) => s.slug === n.subject)?.title ?? n.subject}</>}
              </span>
              <b>{n.title}</b>
              <span>{n.summary}</span>
              {(n.tags.length > 0 || n.sample || made.length > 0) && (
                <span className="post-tags">
                  {n.tags.map((t) => (
                    <i key={t} className="post-tag">
                      {t}
                    </i>
                  ))}
                  {made.map((t) => (
                    <i key={t} className="post-tag nb-made">
                      {t}
                    </i>
                  ))}
                  {n.sample && <i className="post-tag sample">sample</i>}
                </span>
              )}
            </span>
            <span className="post-go" aria-hidden="true">
              <Arrow />
            </span>
          </TLink>
        );
      })}
    </Reveal>
  );
}

function Resources({ list }: { list: Resource[] }) {
  if (!list.length) return null;
  return (
    <ul className="nb-resources">
      {list.map((r) => {
        const inner = (
          <>
            <span className="mono">
              {r.kind} · {r.status}
            </span>
            <b>{r.title}</b>
            {r.by && <span>{r.by}</span>}
          </>
        );
        return (
          <li key={r.title} data-now={r.status === "Using now"}>
            {r.href ? (
              <a href={r.href} target="_blank" rel="noreferrer" className="glass">
                {inner}
              </a>
            ) : (
              <div className="glass">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// One topic as a card: its name and how much has been written in it.
function TopicCard({ topic }: { topic: Topic }) {
  const { notes } = useContent();
  const mine = notesIn(notes, topic.subject, topic.slug);
  const deck = useMemo(() => deckFor(topic, notes), [topic, notes]);
  return (
    <TLink href={`/learning/${topic.subject}/${topic.slug}`} className="nb-topic glass">
      <span className="mono">{topic.level ?? "Topic"}</span>
      <b>{topic.title}</b>
      <span className="nb-topic-short">{topic.short}</span>
      <span className="nb-topic-foot mono">
        <span>
          {mine.length} {mine.length === 1 ? "note" : "notes"}
          {deck.length > 0 && ` · ${deck.length} cards`}
        </span>
      </span>
    </TLink>
  );
}

// What sits on /learning under the heading: search, what was written last, and the subjects.
export function LearningHome() {
  const { subjects, topics, notes } = useContent();
  const [latest, more] = useMore(useMemo(() => [...notes].sort((a, b) => b.date.localeCompare(a.date)), [notes]), 4);
  return (
    <NotebookNav here={{ href: "/learning" }}>
      <NotebookBar />
      <section className="wrap section nb-home-top">
        <JumpField />
        <p className="mono nb-home-count rise" style={d(120)}>
          {subjects.length} subjects · {topics.length} topics · {notes.length} notes
        </p>
      </section>
      <section className="wrap section">
        <div className="section-head">
          <h2>Lately</h2>
          <span className="mono">The last things I wrote up</span>
        </div>
        <NoteList list={latest} showPlace />
        {more}
      </section>
      <section className="wrap section">
        <div className="section-head">
          <h2>Subjects</h2>
          <span className="mono">Everything, by subject and topic</span>
        </div>
        <Reveal className="nb-subjects">
          {subjects.map((s) => {
            const inside = topics.filter((t) => t.subject === s.slug);
            const count = notes.filter((n) => n.subject === s.slug).length;
            return (
              <div key={s.slug} className="nb-subject glass">
                <TLink href={`/learning/${s.slug}`} className="nb-subject-head">
                  <SubjectArt slug={s.slug} />
                  <span>
                    <b>{s.title}</b>
                    <span className="nb-subject-short">{s.short}</span>
                  </span>
                  <span className="post-go" aria-hidden="true">
                    <Arrow />
                  </span>
                </TLink>
                <div className="nb-subject-topics">
                  {inside.map((t) => (
                    <TLink key={t.slug} href={`/learning/${t.subject}/${t.slug}`} className="nb-chip">
                      {t.title}
                    </TLink>
                  ))}
                  <span className="mono">
                    {count} {count === 1 ? "note" : "notes"}
                  </span>
                </div>
              </div>
            );
          })}
        </Reveal>
      </section>
    </NotebookNav>
  );
}

// On a wide screen the subject you are in is listed beside the page, with the other subjects one press away.
function Shelf({ subject, at }: { subject: Subject; at: string }) {
  const { subjects, topics, notes } = useContent();
  const jump = useJump();
  const go = useGo();
  const mine = topics.filter((t) => t.subject === subject.slug);
  const loose = notesIn(notes, subject.slug, "");
  const link = (href: string, label: string, kind: string) => (
    <TLink key={href} href={href} className="nb-shelf-link" data-kind={kind} aria-current={href === at ? "page" : undefined}>
      {label}
    </TLink>
  );
  return (
    <nav className="nb-shelf" aria-label="The notebook">
      <div className="nb-shelf-pick">
        <Pick label="Subject" value={subject.slug} options={subjects.map((x) => [x.slug, x.title] as const)} onChange={(slug) => slug !== subject.slug && go(`/learning/${slug}`)} />
      </div>
      <button type="button" className="nb-shelf-find mono" onClick={() => jump(true)}>
        Search <kbd>/</kbd>
      </button>
      <div className="nb-shelf-body">
        {link(`/learning/${subject.slug}`, "Overview", "topic")}
        {mine.map((t) => (
          <div key={t.slug} className="nb-shelf-group">
            {link(`/learning/${t.subject}/${t.slug}`, t.title, "topic")}
            {notesIn(notes, t.subject, t.slug)
              .reverse()
              .map((n) => link(`/learning/${n.subject}/${n.slug}`, n.title, "note"))}
          </div>
        ))}
        {loose.length > 0 && (
          <div className="nb-shelf-group">
            {mine.length > 0 && (
              <span className="nb-shelf-link" data-kind="topic">
                Other notes
              </span>
            )}
            {loose.reverse().map((n) => link(`/learning/${n.subject}/${n.slug}`, n.title, "note"))}
          </div>
        )}
      </div>
    </nav>
  );
}

// /learning/<subject>
export function SubjectView({ subject }: { subject: Subject }) {
  const { topics, notes } = useContent();
  const mine = topics.filter((t) => t.subject === subject.slug);
  const loose = notesIn(notes, subject.slug, "");
  const at = `/learning/${subject.slug}`;
  return (
    <main className="page" data-kind="learning">
      <NotebookNav here={{ subject: subject.slug, href: at }}>
        <NotebookBar subject={subject} />
        <div className="wrap nb-layout">
          <Shelf subject={subject} at={at} />
          <article className="nb-page">
            <div className="nb-title rise" style={d(60)}>
              <SubjectArt slug={subject.slug} />
              <h1>
                <span className="name">{subject.title}</span>
              </h1>
            </div>
            {subject.now && (
              <p className="nb-now glass rise" style={d(120)}>
                <span className="mono">Right now</span>
                {subject.now}
              </p>
            )}
            <div className="rise" style={d(170)}>
              <Markdown source={subject.about} className="nb-about" />
            </div>
            {mine.length > 0 && (
              <section>
                <div className="section-head sub">
                  <h2>Topics</h2>
                  <span className="mono">Each with its own notes and cards</span>
                </div>
                <Reveal className="nb-topics">
                  {mine.map((t) => (
                    <TopicCard key={t.slug} topic={t} />
                  ))}
                </Reveal>
              </section>
            )}
            {(loose.length > 0 || mine.length === 0) && (
              <section>
                <div className="section-head sub">
                  <h2>{mine.length ? "Other notes" : "Notes"}</h2>
                </div>
                <NoteList list={loose} />
              </section>
            )}
            {!!subject.links?.length && (
              <p className="nb-links">
                {subject.links.map((l) => (
                  <TLink key={l.href} href={l.href} className="btn btn-ghost small">
                    {l.label} <Arrow />
                  </TLink>
                ))}
              </p>
            )}
          </article>
        </div>
      </NotebookNav>
      <Footer />
    </main>
  );
}

// /learning/<subject>/<topic>: the topic's notes in order, its cards to study, and what I am learning it from.
export function TopicView({ topic }: { topic: Topic }) {
  const { subjects, notes } = useContent();
  const subject = subjects.find((s) => s.slug === topic.subject) ?? blank(topic.subject);
  const mine = notesIn(notes, topic.subject, topic.slug);
  const deck = useMemo(() => deckFor(topic, notes), [topic, notes]);
  const tags = [...new Set(mine.flatMap((n) => n.tags))];
  const [tag, setTag] = useState("");
  const [oldest, setOldest] = useState(true);
  const shown = mine.filter((n) => !tag || n.tags.includes(tag));
  const at = `/learning/${topic.subject}/${topic.slug}`;
  const parts = [
    ["notes", <>Notes <i>{mine.length}</i></>],
    ...(deck.length ? [["cards", <>Cards <i>{deck.length}</i></>] as const] : []),
    ...(topic.resources.length ? [["from", <>Sources <i>{topic.resources.length}</i></>] as const] : []),
  ] as (readonly [string, React.ReactNode])[];
  const [part, setPart] = useState("notes");
  return (
    <main className="page" data-kind="learning">
      <NotebookNav here={{ subject: subject.slug, topic: topic.slug, href: at }}>
        <NotebookBar subject={subject} topic={topic} />
        <div className="wrap nb-layout">
          <Shelf subject={subject} at={at} />
          <article className="nb-page">
            <h1 className="rise" style={d(60)}>
              <span className="name">{topic.title}</span>
            </h1>
            <p className="nb-meta rise" style={d(110)}>
              {topic.level && <span className="post-tag">{topic.level}</span>}
              {topic.since && <span className="mono">Since {topic.since}</span>}
              {topic.sample && <span className="post-tag sample">sample</span>}
            </p>
            <div className="rise" style={d(150)}>
              <Markdown source={topic.about} className="nb-about" />
            </div>
            {parts.length > 1 && (
              <div className="nb-parts rise" style={d(200)}>
                <Tabs label="Parts of this topic" value={part} options={parts} onChange={setPart} />
              </div>
            )}
            <div className="nb-part" key={part} role="tabpanel">
              {part === "cards" && deck.length > 0 ? (
                <>
                  <p className="nb-part-lead">The things from these notes worth knowing by heart, one to a card.</p>
                  <Deck cards={deck} voice={topic.voice} />
                </>
              ) : part === "from" ? (
                <Resources list={topic.resources} />
              ) : (
                <>
                  {(tags.length > 1 || mine.length > 1) && (
                    <div className="nb-filter">
                      {tags.length > 1 && (
                        <div className="nb-tags" role="group" aria-label="Filter by tag">
                          <Pill />
                          {["", ...tags].map((t) => (
                            <button key={t} type="button" className="sp-chip" aria-pressed={tag === t} onClick={() => setTag(t)}>
                              {t || "Everything"}
                            </button>
                          ))}
                        </div>
                      )}
                      {mine.length > 1 && (
                        <button type="button" className="mono nb-order" onClick={() => setOldest(!oldest)}>
                          {oldest ? "In the order written" : "Newest first"}
                        </button>
                      )}
                    </div>
                  )}
                  <NoteList key={`${tag}${oldest}`} list={oldest ? [...shown].reverse() : shown} numbered={oldest && !tag} />
                </>
              )}
            </div>
          </article>
        </div>
      </NotebookNav>
      <Footer />
    </main>
  );
}

// /learning/<subject>/<note>: one page of the notebook.
export function NoteView({ note }: { note: Note }) {
  const { subjects, topics, notes } = useContent();
  const subject = subjects.find((s) => s.slug === note.subject) ?? blank(note.subject);
  const topic = topics.find((t) => t.subject === note.subject && t.slug === note.topic);
  // Step through the topic in the order it was written.
  const run = notesIn(notes, note.subject, note.topic ?? "").reverse();
  const at = run.findIndex((n) => n.slug === note.slug);
  const before = run[at - 1], after = run[at + 1];
  const heads = useMemo(() => headingsOf(note.md).map((h) => ({ ...h, text: <InlineMarkdown source={h.text} /> })), [note.md]);
  const href = `/learning/${note.subject}/${note.slug}`;
  const toc = heads.length > 2;
  return (
    <main className="page" data-kind="learning">
      <NotebookNav here={{ subject: subject.slug, topic: topic?.slug, href }}>
        <NotebookBar subject={subject} topic={topic} title={note.title} />
        <div className="wrap nb-layout" data-toc={toc}>
          <Shelf subject={subject} at={href} />
          <article className="nb-page">
            <h1 className="rise nb-note-title" style={d(60)}>
              <span className="name">{note.title}</span>
            </h1>
            <p className="nb-meta rise" style={d(110)}>
              <span className="mono">{longDate(note.date)}</span>
              {at >= 0 && run.length > 1 && (
                <span className="mono">
                  Page {at + 1} of {run.length}
                </span>
              )}
              {note.tags.map((t) => (
                <span key={t} className="post-tag">
                  {t}
                </span>
              ))}
              {note.sample && <span className="post-tag sample">sample</span>}
            </p>
            {toc && <Toc heads={heads} />}
            <div className="nb-sheet glass rise" style={d(170)}>
              <Markdown source={note.md} />
            </div>
            <div className="nb-turn">
              {before ? (
                <TLink href={`/learning/${before.subject}/${before.slug}`} className="glass">
                  <span className="mono">Before this</span>
                  <b>{before.title}</b>
                </TLink>
              ) : (
                <span />
              )}
              {after ? (
                <TLink href={`/learning/${after.subject}/${after.slug}`} className="glass" data-next>
                  <span className="mono">After this</span>
                  <b>{after.title}</b>
                </TLink>
              ) : (
                <TLink href={topic ? `/learning/${topic.subject}/${topic.slug}` : `/learning/${subject.slug}`} className="glass" data-next>
                  <span className="mono">Back to</span>
                  <b>{topic?.title ?? subject.title}</b>
                </TLink>
              )}
            </div>
          </article>
          {toc && <Toc heads={heads} side />}
        </div>
      </NotebookNav>
      <Footer />
    </main>
  );
}
