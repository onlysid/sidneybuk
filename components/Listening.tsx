"use client";

import { useSite } from "@/components/Content";
import { useEffect, useState } from "react";
import { site } from "@/lib/site";
import { useLive } from "@/lib/live";

type Track = { configured: boolean; playing?: boolean; title?: string; artist?: string; url?: string; art?: string; source?: string; sample?: boolean };

// What I am listening to, from /api/now-playing (Spotify, Apple Music, Last.fm, or any mix of them).
export function Listening() {
  const site = useSite();
  const { data: heard } = useLive<Track>("/api/now-playing", { every: 20, remember: true });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const track = mounted ? heard : null;
  const has = !!track?.title;
  const profiles = [
    ["Spotify", site.social.spotify],
    ["Apple Music", site.social.appleMusic],
  ].filter(([, href]) => href);
  return (
    <div className="mu-listen glass" data-ringbox="" data-playing={has && !!track?.playing} data-link={has && !!track?.url}>
      <div className="mu-listen-art" aria-hidden="true">
        {has && track?.art ? <img src={track.art} alt="" /> : null}
        <span className="mu-bars">
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="mu-listen-text">
        <span className="mono">
          {!track ? "Checking…" : !has ? "Now listening" : track.playing ? "Listening now" : "Last played"}
          {has && track?.source ? ` · ${track.source}` : ""}
          {track?.sample ? " · sample" : ""}
        </span>
        {has ? (
          <>
            <b>{track?.url ? <a href={track.url} target="_blank" rel="noreferrer" data-ring-up="">{track.title}</a> : track?.title}</b>
            <span>{track?.artist}</span>
          </>
        ) : (
          <>
            <b>Nothing connected yet</b>
            <span>What I am listening to shows here once Spotify or Last.fm is connected.</span>
          </>
        )}
        {profiles.length > 0 && (
          <span className="mu-listen-links">
            {profiles.map(([name, href]) => (
              <a key={name} href={href} target="_blank" rel="noreferrer" className="post-tag">
                My {name}
              </a>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
