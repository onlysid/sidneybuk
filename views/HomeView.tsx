"use client";

import { useContent } from "@/components/Content";
import { CopyEmail } from "@/components/CopyEmail";
import { DisciplineArt } from "@/components/DisciplineArt";
import { HeroLogo } from "@/components/HeroLogo";
import { Tilt } from "@/components/Tilt";
import { Here } from "@/components/Here";
import { Footer } from "@/components/Footer";
import { TLink } from "@/components/Transition";
import { Typed } from "@/components/Typed";
import { MorePosts } from "@/components/More";
import { disciplines, site } from "@/lib/site";

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const d = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as React.CSSProperties;

export function HomeView() {
  const { posts } = useContent();
  return (
    <main className="page">
      <section className="wrap hero">
        <div className="hero-copy">
          <h1 className="rise">
            <span className="hi">Hi, I&rsquo;m</span> <span className="name">{site.name}</span>
          </h1>
          <div className="rise" style={d(120)}>
            <Typed words={site.interests} />
          </div>
          <p className="lede rise" style={d(220)}>
            {site.intro}
          </p>
          <div className="rise" style={d(270)}>
            <Here />
          </div>
          <div className="actions rise" style={d(320)}>
            <a className="btn btn-primary" href={site.resumeUrl} target="_blank" rel="noreferrer">
              Résumé <Arrow />
            </a>
            <TLink className="btn btn-glass glass" href="/contact">
              Contact
            </TLink>
          </div>
        </div>

        <div className="hero-stage rise" style={d(200)}>
          <Tilt className="hero-tilt" max={14}>
            <HeroLogo />
          </Tilt>
        </div>
      </section>

      <section id="work" className="wrap section">
        <div className="section-head">
          <h2>What I do</h2>
          <span className="mono">Pick one to explore</span>
        </div>
        <div className="grid">
          {disciplines.map((item, n) => (
            <Tilt key={item.slug} className="rise" max={8}>
              <TLink href={`/${item.slug}`} className="card glass" style={d(500 + n * 90)}>
                <div className="card-art">
                  <DisciplineArt kind={item.slug} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.short}</p>
                <span className="card-go mono">
                  Open <Arrow />
                </span>
              </TLink>
            </Tilt>
          ))}
        </div>
      </section>

      {posts.length > 0 && (
        <section id="writing" className="wrap section">
          <div className="section-head">
            <h2>Blog</h2>
            <TLink href="/blog" className="mono">
              All posts
            </TLink>
          </div>
          <MorePosts posts={posts} step={3} />
        </section>
      )}

      <section id="contact" className="wrap">
        <div className="contact glass">
          <div>
            <h2>Get in touch</h2>
            <p>The portfolio is still being built, so watch this space. Until then, email is the best way to reach me.</p>
          </div>
          <CopyEmail email={site.email} />
        </div>
      </section>

      <Footer />
    </main>
  );
}
