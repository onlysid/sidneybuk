"use client";

import { useSite } from "@/components/Content";
import { disciplines, site as identity } from "@/lib/site";
import { InstallButton } from "./Install";
import { Mark } from "./Mark";
import { TLink } from "./Transition";
import { Built } from "./Built";

// The foot of every page, kept light: who this is, one line of every section, and one quiet line of housekeeping.
export function Footer() {
  const site = useSite();
  const elsewhere = [
    ["GitHub", site.integrations.github ? `https://github.com/${site.integrations.github}` : ""],
    ["YouTube", site.social.youtube],
    ["Instagram", site.social.instagram],
    ["Strava", site.social.strava],
  ].filter(([, href]) => href);
  return (
    <footer className="footer wrap">
      <div className="footer-head">
        <TLink href="/" className="footer-me" aria-label="Home">
          <Mark id="footer" />
          <b>{identity.name}</b>
        </TLink>
        <span className="footer-out">
          <a href={`mailto:${identity.email}`}>{identity.email}</a>
          {elsewhere.map(([name, href]) => (
            <a key={name} href={href} target="_blank" rel="noreferrer">
              {name}
            </a>
          ))}
        </span>
      </div>
      <nav className="footer-nav" aria-label="Sections">
        {disciplines.map((d) => (
          <TLink key={d.slug} href={`/${d.slug}`}>
            {d.title}
          </TLink>
        ))}
        <TLink href="/blog">Blog</TLink>
      </nav>
      <div className="footer-base">
        <span className="footer-left">
          <span>
            © {new Date().getFullYear()} {identity.name}
          </span>
          <Built />
        </span>
        <span className="footer-small">
          <TLink href="/contact">Contact</TLink>
          <TLink href="/changelog">Changelog</TLink>
          <TLink href="/privacy">Privacy</TLink>
          <TLink href="/admin">Sign in</TLink>
          <InstallButton />
        </span>
      </div>
    </footer>
  );
}
