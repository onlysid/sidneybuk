import { CvGet } from "@/components/CvGet";
import { Footer } from "@/components/Footer";
import { TLink } from "@/components/Transition";
import { runsOf, stamp, type Cv } from "@/lib/cv";
import { site } from "@/lib/site";

const d = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as React.CSSProperties;

// The CV as a page, the same words as the PDF, with the PDF in both colours to take away.
function Runs({ text }: { text: string }) {
  return (
    <>
      {runsOf(text).map((r, i) => (r.bold ? <b key={i}>{r.text}</b> : <span key={i}>{r.text}</span>))}
    </>
  );
}
function Chips({ items }: { items: string[] }) {
  return (
    <div className="cv-chips">
      {items.map((item, k) => (
        <span key={k} className="cv-chip">
          {item}
        </span>
      ))}
    </div>
  );
}
function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="cv-bullets">
      {items.map((b, k) => (
        <li key={k}>
          <Runs text={b} />
        </li>
      ))}
    </ul>
  );
}

export function CvView({ cv }: { cv: Cv }) {
  return (
    <main className="page" data-kind="cv">
      <section className="wrap d-hero">
        <div className="d-copy">
          <p className="mono rise">
            <TLink href="/">Home</TLink> / CV
          </p>
          <h1 className="rise" style={d(80)}>
            <span className="name">Curriculum vitae</span>
          </h1>
          <p className="lede rise" style={d(160)}>
            Last edited {stamp(cv.updatedAt)}. The PDF is made from this page, in either colour.
          </p>
          <div className="rise" style={d(220)}>
            <CvGet name={site.name} />
          </div>
        </div>
      </section>
      <section className="wrap section">
        <article className="cv glass rise" style={d(280)}>
          <header className="cv-head">
            <div className="cv-who">
              <img className="cv-mark" src="/icons/icon-192.png" alt="" width={40} height={40} />
              <div>
                <h2>{site.name}</h2>
                {cv.headline && <p className="cv-headline mono">{cv.headline}</p>}
              </div>
            </div>
            <p className="cv-reach">
              <a href={site.url}>{site.domain}</a>
              <a href={`mailto:${site.email}`}>{site.email}</a>
              {cv.phone && <a href={`tel:${cv.phone.replace(/\s+/g, "")}`}>{cv.phone}</a>}
              {cv.linkedin && (
                <a href={cv.linkedin} target="_blank" rel="noreferrer">
                  {cv.linkedin.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              )}
            </p>
          </header>
          <div className="cv-stripe" aria-hidden="true" />
          {cv.summary && (
            <p className="cv-summary">
              <Runs text={cv.summary} />
            </p>
          )}
          {cv.skills.length > 0 && (
            <section className="cv-section">
              <h3 className="mono">Skills</h3>
              {cv.skills.map((g, i) => (
                <div key={i} className="cv-skills">
                  <span className="cv-skills-label mono">{g.label}</span>
                  <Chips items={g.items} />
                </div>
              ))}
            </section>
          )}
          {cv.jobs.length > 0 && (
            <section className="cv-section">
              <h3 className="mono">Experience</h3>
              {cv.jobs.map((j, i) => (
                <div key={i} className="cv-job">
                  <div className="cv-job-head">
                    <h4>
                      {j.role}
                      {j.org && <span> · {j.org}</span>}
                    </h4>
                    {j.when && <span className="cv-when mono">{j.when}</span>}
                  </div>
                  <Bullets items={j.bullets} />
                  {j.projects.map((p, k) => (
                    <div key={k} className="cv-project">
                      <div className="cv-project-head">
                        <b>{p.name}</b>
                        {p.role && <span className="cv-pill mono">{p.role}</span>}
                      </div>
                      <Bullets items={p.bullets} />
                    </div>
                  ))}
                </div>
              ))}
            </section>
          )}
          {cv.education.length > 0 && (
            <section className="cv-section">
              <h3 className="mono">Education</h3>
              {cv.education.map((l, i) => (
                <p key={i} className="cv-line">
                  <Runs text={l} />
                </p>
              ))}
            </section>
          )}
          {cv.interests.length > 0 && (
            <section className="cv-section">
              <h3 className="mono">Interests</h3>
              <Chips items={cv.interests} />
            </section>
          )}
          <p className="cv-stamp mono">Last edited {stamp(cv.updatedAt)} · {site.domain}/cv</p>
        </article>
      </section>
      <Footer />
    </main>
  );
}
