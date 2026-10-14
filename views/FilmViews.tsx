"use client";

import { useContent } from "@/components/Content";
import { Gallery, Picture, ProjectWall, YouTubeFeed } from "@/components/Film";
import { Footer } from "@/components/Footer";
import { TLink } from "@/components/Transition";
import { CameraSim } from "@/components/toys/CameraSim";
import { PhotoLab } from "@/components/toys/PhotoLab";
import { type Project } from "@/lib/film";

const d = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as React.CSSProperties;
const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const longDate = (date: string) => new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// What sits on /film under the heading: the way in to the fun stuff, projects, Instagram and YouTube.
export function FilmHome() {
  const { projects } = useContent();
  return (
    <>
      <section className="wrap section">
        <TLink href="/film/fun" className="mu-fun glass fp-fun">
          <span className="mu-fun-art fp-fun-art" aria-hidden="true">
            <svg viewBox="-50 -50 100 100">
              <circle r="40" />
              {[0, 1, 2, 3, 4, 5].map((k) => (
                <line key={k} x1={18 * Math.cos(k * 1.047)} y1={18 * Math.sin(k * 1.047)} x2={40 * Math.cos(k * 1.047 + 1.25)} y2={40 * Math.sin(k * 1.047 + 1.25)} />
              ))}
            </svg>
          </span>
          <span className="mu-fun-text">
            <span className="mono">Play with it</span>
            <b>The fun stuff</b>
            <span>How a camera actually works, in things you can drag: aperture and f-stops, bokeh, lenses, focal length, shutter speed and light. And a camera to shoot a roll with.</span>
          </span>
          <span className="door-arrow" aria-hidden="true">
            <Arrow />
          </span>
        </TLink>
      </section>
      <section className="wrap section">
        <div className="section-head">
          <h2>Projects</h2>
          <span className="mono">Trips, photographs and videos</span>
        </div>
        <ProjectWall projects={projects} />
      </section>
      <section className="wrap section">
        <div className="section-head">
          <h2>On YouTube</h2>
          <span className="mono">Films and edits</span>
        </div>
        <YouTubeFeed />
      </section>
    </>
  );
}

// /film/fun: how the pictures get made.
export function FilmFunView() {
  const { projects } = useContent();
  return (
    <main className="page" data-kind="film">
      <section className="wrap d-hero mu-fun-hero">
        <div className="d-copy">
          <p className="mono rise">
            <TLink href="/">Home</TLink> / <TLink href="/film">Film and photo</TLink> / The fun stuff
          </p>
          <h1 className="rise" style={d(80)}>
            <span className="name">The fun stuff</span>
          </h1>
          <p className="lede rise" style={d(160)}>
            A camera is a box with a hole in it. Everything else is deciding how big the hole is, how long it stays open, and what the glass in front of it does to the light.
          </p>
        </div>
      </section>
      <section className="wrap section">
        <PhotoLab />
      </section>
      <section className="wrap section">
        <div className="section-head">
          <h2>Now put it together</h2>
          <span className="mono">One camera, every control from above, one living scene. Press the shutter to keep a frame.</span>
        </div>
        <div className="toy glass">
          <CameraSim />
        </div>
      </section>
      <section className="wrap section">
        <TLink href="/film" className="btn btn-glass glass">
          ← Back to Film and photo
        </TLink>
      </section>
      <Footer />
    </main>
  );
}

// /film/projects/<slug>: one project in full.
export function ProjectView({ project }: { project: Project }) {
  const { projects } = useContent();
  const index = projects.findIndex((x) => x.slug === project.slug);
  const next = projects[(index + 1) % projects.length];
  return (
    <main className="page" data-kind="film">
      <article className="wrap work">
        <p className="mono rise">
          <TLink href="/">Home</TLink> / <TLink href="/film">Film and photo</TLink> / {project.title}
        </p>
        <h1 className="rise" style={d(80)}>
          <span className="name">{project.title}</span>
        </h1>
        <p className="lede rise" style={d(150)}>
          {project.note}
        </p>
        <div className="work-actions rise" style={d(210)}>
          <span className="post-tag">{project.kind}</span>
          {project.place && <span className="post-tag">{project.place}</span>}
          <span className="post-tag">{longDate(project.date)}</span>
          {project.sample && <span className="post-tag sample">sample project</span>}
        </div>

        <div className="fp-hero glass rise" style={d(280)}>
          {project.kind === "Video" && project.youtube ? (
            <iframe src={`https://www.youtube-nocookie.com/embed/${project.youtube}`} title={project.title} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
          ) : (
            <>
              <Picture frame={project.cover} alt={project.title} />
              {project.kind === "Video" && <span className="fp-hero-note mono">The video plays here once its YouTube ID is in lib/film.ts</span>}
            </>
          )}
        </div>

        <div className="work-cols rise" style={d(340)}>
          <div className="work-body">
            {project.body.map((para, n) => (
              <p key={n}>{para}</p>
            ))}
          </div>
          {project.facts && (
            <dl className="work-facts glass">
              {project.facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="mono">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {project.frames.length > 0 && (
          <section className="mu-block">
            <div className="section-head">
              <h2>{project.kind === "Video" ? "Stills" : "Frames"}</h2>
              <span className="mono">Tap one to see it large</span>
            </div>
            <Gallery frames={project.frames} />
          </section>
        )}

        {next.slug !== project.slug && (
          <TLink href={`/film/projects/${next.slug}`} className="door glass end work-next">
            <span className="door-art" aria-hidden="true">
              <Picture frame={next.cover} />
            </span>
            <span className="door-arrow" aria-hidden="true">
              <Arrow />
            </span>
            <span className="door-text">
              <span className="mono">Next project</span>
              <b>{next.title}</b>
            </span>
          </TLink>
        )}
      </article>
      <Footer />
    </main>
  );
}
