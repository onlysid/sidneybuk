"use client";

import { useContent } from "@/components/Content";
import { type Piece } from "@/lib/repertoire";
import { Tilt } from "./Tilt";
import { TLink } from "./Transition";

function Card({ piece }: { piece: Piece }) {
  return (
    <Tilt className="mu-piece-tilt">
      <TLink href={`/music/pieces/${piece.slug}`} className="mu-piece glass">
        <span className="rep-ring" role="img" aria-label={`Proficiency ${piece.proficiency} out of 100`}>
          <svg viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" className="rep-track" />
            <circle cx="32" cy="32" r="26" className="rep-fill" pathLength={100} style={{ strokeDasharray: `${piece.proficiency} 100` }} />
          </svg>
          <b>{piece.proficiency}</b>
        </span>
        <span className="mu-piece-text">
          <b>{piece.title}</b>
          <span>
            {piece.composer}
            {piece.catalogue ? ` · ${piece.catalogue}` : ""}
          </span>
          <small>{piece.note}</small>
        </span>
        <span className="mu-piece-tags">
          {piece.instruments.map((name) => (
            <span key={name} className="rep-tag">
              {name}
            </span>
          ))}
          {piece.grade && <span className="rep-tag rep-grade">{piece.grade}</span>}
          {piece.score && <span className="rep-tag">full score</span>}
          {piece.recordings.length > 0 && <span className="rep-tag">my recording</span>}
          {piece.sample && <span className="rep-tag sample">sample entry</span>}
        </span>
      </TLink>
    </Tilt>
  );
}

// The pieces I play, in two groups: the ones I know and the ones I am learning. Each opens its own page.
export function Repertoire() {
  const { repertoire } = useContent();
  const known = repertoire.filter((p) => p.stage !== "Learning");
  const learning = repertoire.filter((p) => p.stage === "Learning");
  return (
    <div className="mu-groups">
      {[
        ["Pieces I know", "Full score, a digital performance, and my own recording where I have one", known] as const,
        ["Pieces I am learning", "Not there yet", learning] as const,
      ].map(
        ([title, hint, list]) =>
          list.length > 0 && (
            <div key={title} className="mu-group">
              <div className="section-head">
                <h2>{title}</h2>
                <span className="mono">{hint}</span>
              </div>
              <div className="mu-pieces">
                {list.map((piece) => (
                  <Card key={piece.slug} piece={piece} />
                ))}
              </div>
            </div>
          ),
      )}
    </div>
  );
}
