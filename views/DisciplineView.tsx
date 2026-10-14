import { DisciplineArt } from "@/components/DisciplineArt";
import { Footer } from "@/components/Footer";
import { GitHubPanel } from "@/components/GitHubPanel";
import { Pager } from "@/components/Pager";
import { PortfolioGrid } from "@/components/PortfolioGrid";
import { Stack } from "@/components/Stack";
import { Social } from "@/components/Social";
import { TLink } from "@/components/Transition";
import { Library } from "@/components/Books";
import { MathsPlay } from "@/components/toys/MathsPlay";
import { Terminal } from "@/components/toys/Terminal";
import { portfolio } from "@/lib/portfolio";
import { disciplines, site, type Slug } from "@/lib/site";
import { FilmHome } from "./FilmViews";
import { LearningHome } from "./LearningViews";
import { MusicHome } from "./MusicViews";
import { SportHome } from "./SportViews";
import { TravelHome } from "./TravelViews";
import { Here } from "@/components/Here";

const d = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as React.CSSProperties;

const TOYS: Record<Slug, () => React.ReactNode> = {
  code: () => <Terminal />,
  maths: () => <MathsPlay />,
  music: () => null, // the music page has its own layout; the things to play with live at /music/fun
  film: () => null, // the film page has its own layout; the things to play with live at /film/fun
  learning: () => null, // learning has its own layout: subjects, each with its own page
  reading: () => <Library />,
  travel: () => null, // travel has its own layout: the globe, the log, the wish list
  sport: () => null, // sport has its own layout: the numbers, bests, goals and activities
};
const BARE: Slug[] = ["maths", "sport", "reading"]; // these lay out their own cards, so they skip the glass panel

export function DisciplineView({ slug }: { slug: Slug }) {
  const item = disciplines.find((x) => x.slug === slug)!;

  return (
    <main className="page" data-kind={slug}>
      <section className="wrap d-hero">
        <div className="d-art glass rise">
          <DisciplineArt kind={slug} />
        </div>
        <div className="d-copy">
          <p className="mono rise">
            <TLink href="/">Home</TLink> / {item.title}
          </p>
          <h1 className="rise" style={d(80)}>
            <span className="name">{item.title}</span>
          </h1>
          <p className="lede rise" style={d(160)}>
            {item.short}
          </p>
          {slug === "travel" && (
            <div className="rise" style={d(220)}>
              <Here to="#globe" />
            </div>
          )}
          {slug === "music" && (
            <div className="rise" style={d(220)}>
              <Social which={["youtube", "instagram"]} />
            </div>
          )}
          {slug === "sport" && (
            <div className="rise" style={d(220)}>
              <Social which={["strava"]} />
            </div>
          )}
          {slug === "film" && (
            <div className="rise" style={d(220)}>
              <Social which={["instagram", "youtube"]} />
            </div>
          )}
        </div>
      </section>

      {slug === "maths" && (
        <section className="wrap section">
          <div className="degree glass rise" style={d(200)}>
            <div className="degree-seal" aria-hidden="true">
              <svg viewBox="0 0 64 64">
                <path d="M32 10L6 24l26 14 26-14z" />
                <path d="M16 31v13c4 5 10 8 16 8s12-3 16-8V31" />
                <path d="M58 24v16" />
              </svg>
            </div>
            <div className="degree-text">
              <span className="mono">
                {site.degree.place} · {site.degree.year}
              </span>
              <h2>{site.degree.title}</h2>
              <p>
                I studied mathematics and physics together at UCL and graduated in {site.degree.year}. The parts that stayed with me are quantum mechanics and pure mathematics, and since then the maths hiding inside music and inside cryptography. I taught it for years too, tutoring A-level and GCSE maths from 2015 to 2022.
              </p>
            </div>
            <div className="degree-chips">
              {["Quantum mechanics", "Pure mathematics", "Maths of music", "Cryptography"].map((t) => (
                <span key={t} className="post-tag">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {slug === "music" ? (
        <MusicHome />
      ) : slug === "film" ? (
        <FilmHome />
      ) : slug === "learning" ? (
        <LearningHome />
      ) : slug === "travel" ? (
        <TravelHome />
      ) : slug === "sport" ? (
        <SportHome />
      ) : (
        <section className="wrap section">
          <div className="section-head rise" style={d(220)}>
            <h2>{item.toyTitle}</h2>
            <span className="mono">{item.toyHint}</span>
          </div>
          <div className={BARE.includes(slug) ? "toy bare rise" : "toy glass rise"} style={d(300)}>
            {TOYS[slug]()}
          </div>
        </section>
      )}

      {slug === "code" && (
        <>
          <section className="wrap section">
            <Stack />
          </section>
          <section className="wrap section">
            <GitHubPanel />
          </section>
        </>
      )}
      {portfolio[slug].length > 0 && (
        <section className="wrap section">
          <div className="section-head">
            <h2>Portfolio</h2>
            <span className="mono">Work in progress</span>
          </div>
          <PortfolioGrid slug={slug} />
        </section>
      )}

      <Pager slug={slug} />

      <Footer />
    </main>
  );
}
