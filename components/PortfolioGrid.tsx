import { portfolio } from "@/lib/portfolio";
import type { Slug } from "@/lib/site";
import { Tilt } from "./Tilt";
import { TLink } from "./Transition";
import { WorkArt } from "./WorkArt";

// The work for one subject. A piece with a slug opens its own page; pieces without a note show as "coming soon".
export function PortfolioGrid({ slug }: { slug: Slug }) {
  return (
    <div className="grid">
      {portfolio[slug].map((piece, n) => {
        const ready = piece.note.length > 0;
        const body = (
          <article className="piece glass" data-ready={ready}>
            <div className="piece-pic" data-kind={slug}>
              <WorkArt piece={piece} n={n} />
            </div>
            <div className="piece-text">
              <h3>{piece.title}</h3>
              <p>{ready ? piece.note : "Coming soon"}</p>
              {piece.tags && (
                <span className="post-tags">
                  {piece.tags.map((t, k) => (
                    <i key={t} className="post-tag" style={{ ["--k" as string]: k }}>
                      {t}
                    </i>
                  ))}
                </span>
              )}
              {piece.slug && (
                <span className="piece-go mono">
                  Read more
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              )}
            </div>
          </article>
        );
        return (
          <Tilt key={piece.title} max={5}>
            {piece.slug ? (
              <TLink href={`/work/${piece.slug}`} className="piece-link">
                {body}
              </TLink>
            ) : (
              body
            )}
          </Tilt>
        );
      })}
    </div>
  );
}
