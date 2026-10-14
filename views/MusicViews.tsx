"use client";

import { Player } from "@/components/Player";
import { useContent } from "@/components/Content";
import { Footer } from "@/components/Footer";
import { DrumKit } from "@/components/Instruments";
import { Listening } from "@/components/Listening";
import { ListenLinks } from "@/components/ListenLinks";
import { Repertoire } from "@/components/Repertoire";
import { Empty } from "@/components/Empty";
import { ScorePlayer } from "@/components/ScorePlayer";
import { Tilt } from "@/components/Tilt";
import { TLink } from "@/components/Transition";
import { PluckedString } from "@/components/toys/MusicScience";
import { TimeSignatures } from "@/components/toys/TimeSignatures";
import { TuningLab } from "@/components/toys/TuningLab";
import { assets } from "@/lib/assets";
import { type Dose } from "@/lib/doses";
import { longDate } from "@/lib/posts";
import { type Piece } from "@/lib/repertoire";

const d = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as React.CSSProperties;
const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

// The rows of daily doses, newest first.
function DoseList() {
  const { doses } = useContent();
  return (
    <div className="posts">
      {doses.map((dose) => (
        <Tilt key={dose.slug} max={4}>
          <TLink href={`/music/doses/${dose.slug}`} className="post-row glass">
            <span className="post-date mono">{longDate(dose.date)}</span>
            <span className="post-main">
              <b>{dose.title}</b>
              <span>{dose.note}</span>
              <span className="post-tags">
                <i className="post-tag">{dose.kind}</i>
                {dose.instruments.map((t) => (
                  <i key={t} className="post-tag">
                    {t}
                  </i>
                ))}
                {dose.audio && <i className="post-tag">audio</i>}
                {dose.lyrics && <i className="post-tag">lyrics</i>}
                {dose.sample && <i className="post-tag sample">sample</i>}
              </span>
            </span>
            <span className="post-go" aria-hidden="true">
              <Arrow />
            </span>
          </TLink>
        </Tilt>
      ))}
    </div>
  );
}

// What sits on /music under the heading: listening, the way in to the fun stuff, pieces, and daily doses.
export function MusicHome() {
  const { doses } = useContent();
  return (
    <>
      <section className="wrap section mu-top">
        <Listening />
        <TLink href="/music/fun" className="mu-fun glass">
          <span className="mu-fun-art" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6].map((k) => (
              <i key={k} style={{ ["--k" as string]: k }} />
            ))}
          </span>
          <span className="mu-fun-text">
            <span className="mono">Play with it</span>
            <b>The fun stuff</b>
            <span>Instruments to play, tunings and temperaments, time signatures you can count along to, and why a note sounds the way it does.</span>
          </span>
          <span className="door-arrow" aria-hidden="true">
            <Arrow />
          </span>
        </TLink>
      </section>
      <section className="wrap section">
        <Repertoire />
      </section>
      {doses.length > 0 && (
        <section className="wrap section">
          <div className="section-head">
            <h2>Daily doses</h2>
            <span className="mono">Small snippets of what I am working on</span>
          </div>
          <DoseList />
        </section>
      )}
    </>
  );
}

// /music/fun: everything you can play with.
export function MusicFunView() {
  return (
    <main className="page" data-kind="music">
      <section className="wrap d-hero mu-fun-hero">
        <div className="d-copy">
          <p className="mono rise">
            <TLink href="/">Home</TLink> / <TLink href="/music">Music</TLink> / The fun stuff
          </p>
          <h1 className="rise" style={d(80)}>
            <span className="name">The fun stuff</span>
          </h1>
          <p className="lede rise" style={d(160)}>
            Things to press. Everything here makes its own sound, so turn your volume up.
          </p>
        </div>
      </section>
      <section className="wrap section">
        <div className="section-head">
          <h2>Instruments and temperaments</h2>
          <span className="mono">Piano, guitar, marimba, kalimba, voice. Pick one, pick a tuning, and play</span>
        </div>
        <div className="toy glass">
          <TuningLab />
        </div>
        <p className="mu-credit">The piano is the Salamander Grand Piano, recorded by Alexander Holm. The guitar was recorded at the University of Iowa Electronic Music Studios and edited by Nicholaus Brosowsky. Both are used under CC BY 3.0. Everything else is synthesised here.</p>
      </section>
      <section className="wrap section">
        <div className="section-head">
          <h2>Drum kit</h2>
          <span className="mono">Tap the drums, or use the letters on a keyboard once you have tapped one</span>
        </div>
        <div className="toy glass">
          <DrumKit />
        </div>
      </section>
      <section className="wrap section">
        <div className="section-head">
          <h2>Time signatures</h2>
          <span className="mono">How the beats in a bar are grouped</span>
        </div>
        <div className="toy glass">
          <TimeSignatures />
        </div>
      </section>
      <section className="wrap section">
        <div className="section-head">
          <h2>The science of a note</h2>
          <span className="mono">Why a guitar does not sound like a flute</span>
        </div>
        <PluckedString />
      </section>
      <section className="wrap section">
        <TLink href="/music" className="btn btn-glass glass">
          ← Back to Music
        </TLink>
      </section>
      <Footer />
    </main>
  );
}

// Where my copy of the sheet music came from.
function Sources({ list }: { list?: Piece["sources"] }) {
  if (!list?.length) return null;
  return (
    <div className="mu-sources">
      <span className="mono">Sheet music from</span>
      <ul>
        {list.map((x) => (
          <li key={x.name + (x.href ?? "")}>
            {x.href ? (
              <a href={x.href} target="_blank" rel="noreferrer">
                {x.name}
              </a>
            ) : (
              <b>{x.name}</b>
            )}
            {x.note && <span>{x.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// /music/pieces/<slug>: one piece in full.
export function PieceView({ piece }: { piece: Piece }) {
  const { doses, repertoire } = useContent();
  const index = repertoire.findIndex((x) => x.slug === piece.slug);
  const next = repertoire[(index + 1) % repertoire.length];
  const facts: [string, string | undefined][] = [
    ["Composer", piece.composerDates ? `${piece.composer} (${piece.composerDates})` : piece.composer],
    ["Catalogue", piece.catalogue],
    ["Written", piece.written],
    ["Key", piece.key],
    ["Grade", piece.grade],
    ["Instrument", piece.instruments.join(", ")],
    ["Learning since", piece.started],
    ["Where I am", piece.stage],
  ];
  return (
    <main className="page" data-kind="music">
      <article className="wrap work mu-piece-page">
        <p className="mono rise">
          <TLink href="/">Home</TLink> / <TLink href="/music">Music</TLink> / {piece.title}
        </p>
        <h1 className="rise" style={d(80)}>
          <span className="name">{piece.title}</span>
        </h1>
        <p className="lede rise" style={d(150)}>
          {piece.fullTitle ?? piece.title}. {piece.composer}.
        </p>
        <div className="work-actions rise" style={d(210)}>
          <span className="rep-stage" data-stage={piece.stage}>
            {piece.stage}
          </span>
          {piece.catalogue && <span className="post-tag">{piece.catalogue}</span>}
          {piece.key && <span className="post-tag">{piece.key}</span>}
          {piece.grade && <span className="post-tag mu-grade">{piece.grade}</span>}
          {piece.sample && <span className="post-tag sample">sample entry</span>}
        </div>
        <div className="mu-hear rise" style={d(240)}>
          <ListenLinks what={`${piece.composer.split(" ").pop()} ${piece.title} ${piece.catalogue ?? ""}`} exact={piece.listen} label="Listen" />
        </div>

        <div className="work-cols rise" style={d(280)}>
          <div className="work-body">
            {piece.about.map((para, n) => (
              <p key={n}>{para}</p>
            ))}
            {piece.mine && (
              <>
                <h2 className="mu-h">Playing it</h2>
                {piece.mine.map((para, n) => (
                  <p key={n}>{para}</p>
                ))}
              </>
            )}
          </div>
          <dl className="work-facts glass">
            <div className="mu-fact-ring">
              <span className="rep-ring" role="img" aria-label={`Proficiency ${piece.proficiency} out of 100`}>
                <svg viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" className="rep-track" />
                  <circle cx="32" cy="32" r="26" className="rep-fill" pathLength={100} style={{ strokeDasharray: `${piece.proficiency} 100` }} />
                </svg>
                <b>{piece.proficiency}</b>
              </span>
              <span className="mono">How well I know it</span>
            </div>
            {facts.map(
              ([label, value]) =>
                value && (
                  <div key={label}>
                    <dt className="mono">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ),
            )}
          </dl>
        </div>

        <section className="mu-block">
          <div className="section-head">
            <h2>My recording</h2>
            <span className="mono">Me, at a real instrument</span>
          </div>
          {piece.recordings.length === 0 ? (
            <p className="mu-empty glass">Not recorded yet. When I have a take I am happy with, it goes here.</p>
          ) : (
            <div className="mu-takes">
              {piece.recordings.map((take) => (
                <figure key={take.src} className="mu-take glass">
                  <figcaption>
                    <b>{take.label}</b>
                    <span className="mono">{longDate(take.date)}</span>
                    {take.note && <span>{take.note}</span>}
                  </figcaption>
                  <Player src={assets.media[take.src] ?? take.src} title={take.label} />
                </figure>
              ))}
            </div>
          )}
        </section>

        {/* No score on the site for this one: say so, and still say where the sheet music can be had. */}
        {!piece.score && (
          <section className="mu-block">
            <div className="section-head">
              <h2>The score</h2>
            </div>
            <Empty title="No sheet music here yet">
              {piece.pdf || piece.sources?.length ? "The score is not on the site to follow and play along with, but this is where to find it." : "I have not put the score for this one on the site."}
            </Empty>
            {piece.pdf && (
              <div className="mu-downloads">
                <a className="btn btn-ghost small" href={piece.pdf} target="_blank" rel="noreferrer">
                  Printable score (PDF)
                </a>
              </div>
            )}
            <Sources list={piece.sources} />
          </section>
        )}
        {piece.score && (
          <section className="mu-block">
            <div className="section-head">
              <h2>The full score</h2>
              <span className="mono">Played digitally, every note as written</span>
            </div>
            <ScorePlayer src={piece.score} tempo={piece.tempo} instrument={piece.instruments[0]} title={piece.fullTitle ?? piece.title} composer={piece.composer} />
            <div className="mu-downloads">
              <a className="btn btn-ghost small" href={piece.score} download>
                Download the score (MusicXML)
              </a>
              {piece.pdf && (
                <a className="btn btn-ghost small" href={piece.pdf} target="_blank" rel="noreferrer">
                  Printable score (PDF)
                </a>
              )}
            </div>
            <Sources list={piece.sources} />
          </section>
        )}

        {next.slug !== piece.slug && (
          <TLink href={`/music/pieces/${next.slug}`} className="door glass end work-next">
            <span className="door-arrow" aria-hidden="true">
              <Arrow />
            </span>
            <span className="door-text">
              <span className="mono">Next piece</span>
              <b>{next.title}</b>
            </span>
          </TLink>
        )}
      </article>
      <Footer />
    </main>
  );
}

// /music/doses/<slug>: one snippet, with its audio, words and downloads.
export function DoseView({ dose }: { dose: Dose }) {
  const { doses } = useContent();
  const index = doses.findIndex((x) => x.slug === dose.slug);
  const newer = doses[index - 1];
  const older = doses[index + 1];
  return (
    <main className="page" data-kind="music">
      <article className="wrap post">
        <p className="mono rise">
          <TLink href="/">Home</TLink> / <TLink href="/music">Music</TLink> / {dose.title}
        </p>
        <h1 className="rise" style={d(80)}>
          <span className="name">{dose.title}</span>
        </h1>
        <p className="post-meta mono rise" style={d(140)}>
          <span>{longDate(dose.date)}</span>
          <span className="post-tag">{dose.kind}</span>
          {dose.instruments.map((t) => (
            <span key={t} className="post-tag">
              {t}
            </span>
          ))}
          {dose.sample && <span className="post-tag sample">sample</span>}
        </p>
        {dose.audio && (
          <div className="mu-clip glass rise" style={d(200)}>
            <span className="mono">Listen</span>
            <Player src={assets.media[dose.audio] ?? dose.audio} title={dose.title} />
          </div>
        )}
        <div className="post-body glass rise" style={d(240)}>
          {dose.body.map((para, n) => (
            <p key={n}>{para}</p>
          ))}
          {dose.lyrics && (
            <>
              <h2>Lyrics</h2>
              <div className="mu-lyrics">
                {dose.lyrics.map((verse, n) => (
                  <p key={n}>
                    {verse.map((line, k) => (
                      <span key={k}>{line}</span>
                    ))}
                  </p>
                ))}
              </div>
            </>
          )}
          {dose.downloads && (
            <>
              <h2>Downloads</h2>
              <div className="mu-downloads">
                {dose.downloads.map((file) => (
                  <a key={file.name} className="btn btn-ghost small" href={assets.media[file.file] ?? file.file} download={file.name}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
                    </svg>
                    {file.label}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
        <nav className="post-nav" aria-label="More doses">
          {older ? (
            <TLink href={`/music/doses/${older.slug}`} className="btn btn-glass glass">
              ← {older.title}
            </TLink>
          ) : (
            <span />
          )}
          {newer ? (
            <TLink href={`/music/doses/${newer.slug}`} className="btn btn-glass glass">
              {newer.title} →
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
