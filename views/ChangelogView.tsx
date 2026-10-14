"use client";

import { Pill } from "@/components/Pill";
import { useState } from "react";
import { useContent } from "@/components/Content";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Notebook";
import { TLink } from "@/components/Transition";
import { byMonth, TAGS } from "@/lib/changes";
import { shortDay as dayOf } from "@/lib/sport";

const d = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as React.CSSProperties;
// /changelog: what has changed on the site, newest first, down a single line.
export function ChangelogView() {
  const { changes } = useContent();
  const [tag, setTag] = useState("");
  const shown = changes.filter((c) => !tag || c.tag === tag);
  const months = byMonth(shown);
  const used = TAGS.filter((t) => changes.some((c) => c.tag === t));
  return (
    <main className="page" data-kind="changelog">
      <section className="wrap cl-top">
        <p className="mono rise">
          <TLink href="/">Home</TLink> / Changelog
        </p>
        <h1 className="rise" style={d(80)}>
          <span className="name">Changelog</span>
        </h1>
        <p className="lede rise" style={d(160)}>
          What has been added to the site, fixed or made better, newest first.
        </p>
        {used.length > 1 && (
          <div className="sp-chips cl-tags rise" style={d(220)} role="group" aria-label="Kind of change">
              <Pill />
            {["", ...used].map((t) => (
              <button key={t} type="button" className="sp-chip" data-tag={t || undefined} aria-pressed={tag === t} onClick={() => setTag(t)}>
                {t || "Everything"} <em>{t ? changes.filter((c) => c.tag === t).length : changes.length}</em>
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="wrap cl" key={tag}>
        {months.map((m) => (
          <div key={m.month} className="cl-month">
            <h2 className="mono">{m.month}</h2>
            {m.days.map((day) => (
              <div key={day.date} className="cl-day">
                <time dateTime={day.date} className="mono">
                  {dayOf(day.date)}
                </time>
                <Reveal className="cl-list">
                  {day.list.map((c) => (
                    <article key={c.slug} className="cl-item" data-tag={c.tag}>
                      <i className="cl-dot" aria-hidden="true" />
                      <span className="cl-tag mono">{c.tag}</span>
                      <div className="cl-words">
                        <h3>{c.title}</h3>
                        {c.note && <p>{c.note}</p>}
                      </div>
                    </article>
                  ))}
                </Reveal>
              </div>
            ))}
          </div>
        ))}
        {!shown.length && <p className="sp-small">Nothing here yet.</p>}
      </section>
      <Footer />
    </main>
  );
}
