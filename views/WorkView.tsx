import { Footer } from "@/components/Footer";
import { AutoScroll } from "@/components/AutoScroll";
import { HeroLogo } from "@/components/HeroLogo";
import { Shot } from "@/components/Shot";
import { SiteKit } from "@/components/SiteKit";
import { TLink } from "@/components/Transition";
import { WorkArt } from "@/components/WorkArt";
import { assets } from "@/lib/assets";
import { work } from "@/lib/portfolio";
import { bySlug } from "@/lib/site";

const d = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as React.CSSProperties;

// One piece of work: what it is, pictures of it, a few facts, and the next piece.
export function WorkView({ piece }: { piece: (typeof work)[number] }) {
  const subject = bySlug(piece.subject);
  const index = work.findIndex((p) => p.slug === piece.slug);
  const next = work[(index + 1) % work.length];
  const [, ...more] = piece.images ?? [];
  // Device screenshots go in a row you can swipe along; everything else in a grid.
  const phones = more.filter((i) => i.phone || i.pad);
  const photos = more.filter((i) => !i.phone && !i.pad);
  return (
    <main className="page" data-kind="work">
      <article className="wrap work">
        <p className="mono rise">
          <TLink href="/">Home</TLink> / <TLink href={`/${piece.subject}`}>{subject?.title}</TLink> / {piece.title}
        </p>
        <h1 className="rise" style={d(80)}>
          <span className="name">{piece.title}</span>
        </h1>
        <p className="lede rise" style={d(150)}>
          {piece.note}
        </p>
        <div className="work-actions rise" style={d(210)}>
          {piece.href && (
            <a className="btn btn-primary" href={piece.href} target="_blank" rel="noreferrer">
              Visit {piece.href.replace(/^https?:\/\/(www\.)?/, "")}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </a>
          )}
          {piece.tags?.map((t) => (
            <span key={t} className="post-tag">
              {t}
            </span>
          ))}
        </div>

        {/* This site's own entry shows the real animated logo, not a picture of it. */}
        <div className="work-hero glass rise" style={d(280)} data-live={piece.live === "logo"}>
          {piece.live === "logo" ? <HeroLogo /> : <WorkArt piece={piece} />}
        </div>

        <div className="work-cols">
          <div className="work-body">
            {piece.body?.map((para, n) => (
              <p key={n} className="rise" style={d(340 + n * 60)}>
                {para}
              </p>
            ))}
          </div>
          {piece.facts && (
            <dl className="work-facts glass rise" style={d(380)}>
              {piece.year && (
                <div>
                  <dt className="mono">Year</dt>
                  <dd>{piece.year}</dd>
                </div>
              )}
              {piece.facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="mono">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {piece.live === "logo" && <SiteKit />}

        {phones.length > 0 && (
          <AutoScroll className="work-phones" label="Screenshots">
            {phones.map((shot) => (
              <figure key={shot.src} data-pad={!!shot.pad}>
                <Shot src={assets.work[shot.src]} alt={shot.alt} />
              </figure>
            ))}
          </AutoScroll>
        )}

        {photos.length > 0 && (
          <div className="work-shots">
            {photos.map((shot) => (
              <figure key={shot.src} className="glass">
                <Shot src={assets.work[shot.src]} alt={shot.alt} />
                <figcaption>{shot.alt}</figcaption>
              </figure>
            ))}
          </div>
        )}

        {next.slug !== piece.slug && (
          <TLink href={`/work/${next.slug}`} className="door glass end work-next">
            <span className="door-art" aria-hidden="true">
              <WorkArt piece={next} />
            </span>
            <span className="door-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
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
