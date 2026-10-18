import { Footer } from "@/components/Footer";
import { TLink } from "@/components/Transition";
import { bulletsOf, linesOf, rowsOf, runsOf, stamp, type Cv } from "@/lib/cv";
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
function Rows({ text }: { text: string }) {
  return (
    <>
      {rowsOf(text).map((row, i) => (
        <p key={i} className="cv-row">
          {row.map((item, k) => (
            <span key={k}>
              {k > 0 && <i aria-hidden="true"> | </i>}
              {item}
            </span>
          ))}
        </p>
      ))}
    </>
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
          <div className="cv-get rise" style={d(220)}>
            <a className="btn btn-primary" href="/cv/pdf?theme=light" target="_blank" rel="noreferrer">
              PDF, light
            </a>
            <a className="btn btn-ghost" href="/cv/pdf?theme=dark" target="_blank" rel="noreferrer">
              PDF, dark
            </a>
          </div>
        </div>
      </section>
      <section className="wrap section">
        <article className="cv glass rise" style={d(280)}>
          <header className="cv-head">
            <h2>{site.name}</h2>
            <p className="cv-contact mono">
              <a href={site.url}>{site.domain}</a>
              {cv.phone && (
                <>
                  <i aria-hidden="true"> | </i>
                  <a href={`tel:${cv.phone.replace(/\s+/g, "")}`}>{cv.phone}</a>
                </>
              )}
              <i aria-hidden="true"> | </i>
              <a href={`mailto:${site.email}`}>{site.email}</a>
              {cv.linkedin && (
                <>
                  <i aria-hidden="true"> | </i>
                  <a href={cv.linkedin} target="_blank" rel="noreferrer">
                    LinkedIn
                  </a>
                </>
              )}
            </p>
            {cv.summary.trim() && (
              <p className="cv-summary">
                <Runs text={cv.summary.trim()} />
              </p>
            )}
          </header>
          {cv.skills.trim() && (
            <section className="cv-section">
              <h3>Skills</h3>
              <Rows text={cv.skills} />
            </section>
          )}
          {cv.jobs.length > 0 && (
            <section className="cv-section">
              <h3>Experience</h3>
              {cv.jobs.map((j, i) => (
                <div key={i} className="cv-job">
                  <h4>
                    {[j.role, j.org].filter(Boolean).join(", ")}
                    {j.when && <span> — {j.when}</span>}
                  </h4>
                  <ul>
                    {bulletsOf(j.bullets).map((b, k) => (
                      <li key={k} data-depth={b.depth}>
                        <Runs text={b.text} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
          {cv.education.trim() && (
            <section className="cv-section">
              <h3>Education</h3>
              {linesOf(cv.education).map((l, i) => (
                <p key={i} className="cv-line">
                  <Runs text={l} />
                </p>
              ))}
            </section>
          )}
          {cv.interests.trim() && (
            <section className="cv-section">
              <h3>Interests</h3>
              <Rows text={cv.interests} />
            </section>
          )}
          <p className="cv-stamp mono">Last edited {stamp(cv.updatedAt)}</p>
        </article>
      </section>
      <Footer />
    </main>
  );
}
