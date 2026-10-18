"use client";

import { Pic } from "./Pic";
import { Marked, type Token, type Tokens } from "marked";
import dynamic from "next/dynamic";
import { Fragment, useEffect, useMemo, useState } from "react";
import { assets } from "@/lib/assets";
import { slugify } from "@/lib/admin/kinds";
import { CardsBlock } from "./Cards";
import { Demo } from "./Demos";
import { Diagram } from "./Diagram";
import { Player } from "./Player";
import { TLink } from "./Transition";

// Notes are written in Markdown. On top of the usual things (headings, lists, tables, links, code) a note can hold:
//
//   $x^2$ and $$\int_0^1 x\,dx$$            LaTeX, in a line or on its own
//   ![caption](/media/photo.jpg)            a picture; the same line with an audio or video file plays it,
//   ![Prelude](/media/prelude.musicxml)     and with a MusicXML file it is a score that plays itself
//   ![](https://youtu.be/…)                 a YouTube video
//   ```diagram   A -> B: why   ```          a diagram of boxes and arrows (components/Diagram.tsx)
//   ```cards     front :: back   ```        flashcards, which also join the topic's deck
//   ```demo      double-slit     ```        one of the site's interactive pieces, by name (components/Demos.tsx)
//   > [!note]  > [!tip]  > [!warning]       a boxed aside; also [!definition] [!theorem] [!proof] [!example]
//
// The score player is large, so it is only fetched by pages that have a score on them.
const ScorePlayer = dynamic(() => import("./ScorePlayer").then((m) => m.ScorePlayer), { ssr: false, loading: () => <p className="nb-wait">Fetching the score…</p> });

type MathToken = { type: "math"; raw: string; text: string; block: boolean };
const parser = new Marked({ gfm: true });
parser.use({
  extensions: [
    {
      name: "math",
      level: "block",
      start: (src: string) => src.indexOf("$$"),
      tokenizer(src: string) {
        const m = /^\$\$([\s\S]+?)\$\$(?:\n|$)/.exec(src);
        return m ? { type: "math", raw: m[0], text: m[1].trim(), block: true } : undefined;
      },
    },
    {
      name: "math",
      level: "inline",
      start: (src: string) => src.indexOf("$"),
      tokenizer(src: string) {
        const big = /^\$\$([\s\S]+?)\$\$/.exec(src);
        if (big) return { type: "math", raw: big[0], text: big[1].trim(), block: true };
        // A dollar sign only opens maths if what follows hugs it: "$5 and $6" stays as money.
        const m = /^\$(?!\s)((?:\\.|[^$\\\n])+?)(?<!\s)\$(?!\d)/.exec(src);
        return m ? { type: "math", raw: m[0], text: m[1], block: false } : undefined;
      },
    },
  ],
});
export const lex = (md: string) => parser.lexer(md);
// The headings of a note, for its table of contents.
export function headingsOf(md: string) {
  const seen = new Map<string, number>();
  return (lex(md).filter((t) => t.type === "heading" && (t as Tokens.Heading).depth <= 3) as Tokens.Heading[]).map((h) => {
    const base = slugify(h.text) || "section", n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { id: n ? `${base}-${n + 1}` : base, text: h.text.replace(/[*_`$]/g, ""), depth: h.depth };
  });
}

// ---- LaTeX: drawn by KaTeX as MathML, which the browser sets itself, so there are no fonts or styles to load ----
let katex: Promise<typeof import("katex")> | null = null;
export function Tex({ tex, block = false }: { tex: string; block?: boolean }) {
  const [html, setHtml] = useState("");
  useEffect(() => {
    let live = true;
    (katex ??= import("katex")).then((k) => live && setHtml(k.default.renderToString(tex, { output: "mathml", displayMode: block, throwOnError: false, strict: false })), () => {});
    return () => void (live = false);
  }, [tex, block]);
  // Until it is drawn (or if it cannot be), the LaTeX itself is shown.
  if (!html) return block ? <pre className="nb-math nb-raw">{tex}</pre> : <code>{tex}</code>;
  return block ? <div className="nb-math" dangerouslySetInnerHTML={{ __html: html }} /> : <span className="nb-tex" dangerouslySetInnerHTML={{ __html: html }} />;
}

const youtube = (href: string) => /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/.exec(href)?.[1];
const kindOf = (href: string) => (youtube(href) ? "youtube" : /\.(musicxml|mxl|xml)(\?|$)/i.test(href) ? "score" : /\.(mp3|m4a|wav|ogg|flac)(\?|$)/i.test(href) || href.startsWith("data:audio/") ? "audio" : /\.(mp4|webm|mov)(\?|$)/i.test(href) || href.startsWith("data:video/") ? "video" : "image");
const file = (href: string) => (assets.media as Record<string, string>)[href] ?? href;

// Something dropped into a note with the picture syntax: a picture, a recording, a video or a score.
function Embed({ href, text }: { href: string; text: string }) {
  const kind = kindOf(href);
  if (kind === "youtube")
    return (
      <figure className="nb-figure">
        <iframe className="nb-video" src={`https://www.youtube-nocookie.com/embed/${youtube(href)}`} title={text || "Video"} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" />
        {text && <figcaption>{text}</figcaption>}
      </figure>
    );
  if (kind === "score") return <div className="nb-score"><ScorePlayer src={href} tempo={72} title={text || "Score"} /></div>;
  if (kind === "audio")
    return (
      <figure className="nb-figure nb-audio glass">
        <Player src={file(href)} title={text || "Recording"} />
        {text && <figcaption>{text}</figcaption>}
      </figure>
    );
  return (
    <figure className="nb-figure">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {kind === "video" ? <video className="nb-video" src={file(href)} controls playsInline preload="metadata" /> : <Pic src={file(href)} alt={text} upTo={820} sizes="(max-width: 860px) 100vw, 820px" />}
      {text && <figcaption>{text}</figcaption>}
    </figure>
  );
}

const CALLOUTS: Record<string, string> = { note: "Note", tip: "Tip", warning: "Careful", example: "Example", definition: "Definition", theorem: "Theorem", proof: "Proof", question: "Question" };

function Inline({ tokens }: { tokens?: Token[] }) {
  return (
    <>
      {(tokens ?? []).map((t, k) => {
        switch (t.type) {
          case "strong":
            return <strong key={k}><Inline tokens={(t as Tokens.Strong).tokens} /></strong>;
          case "em":
            return <em key={k}><Inline tokens={(t as Tokens.Em).tokens} /></em>;
          case "del":
            return <del key={k}><Inline tokens={(t as Tokens.Del).tokens} /></del>;
          case "codespan":
            return <code key={k}>{(t as Tokens.Codespan).text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")}</code>;
          case "br":
            return <br key={k} />;
          case "math":
            return <Tex key={k} tex={(t as unknown as MathToken).text} block={(t as unknown as MathToken).block} />;
          case "link": {
            const link = t as Tokens.Link;
            const inner = <Inline tokens={link.tokens} />;
            return link.href.startsWith("/") && !/\.\w{2,5}$/.test(link.href) ? (
              <TLink key={k} href={link.href}>{inner}</TLink>
            ) : (
              <a key={k} href={link.href} target={link.href.startsWith("#") ? undefined : "_blank"} rel="noreferrer">{inner}</a>
            );
          }
          case "image":
            return <Embed key={k} href={(t as Tokens.Image).href} text={(t as Tokens.Image).text} />;
          case "text": {
            const text = t as Tokens.Text;
            return text.tokens ? <Inline key={k} tokens={text.tokens} /> : <Fragment key={k}>{unescape(text.text)}</Fragment>;
          }
          case "escape":
            return <Fragment key={k}>{(t as Tokens.Escape).text}</Fragment>;
          default:
            return <Fragment key={k}>{"raw" in t ? unescape(String(t.raw)) : ""}</Fragment>;
        }
      })}
    </>
  );
}
const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

const GIVEN = new WeakMap<object, string>();
function Blocks({ tokens, ids }: { tokens: Token[]; ids: Map<string, number> }) {
  return (
    <>
      {tokens.map((t, k) => {
        switch (t.type) {
          case "space":
            return null;
          case "heading": {
            const h = t as Tokens.Heading;
            // A heading's id is worked out once and remembered against the heading itself.
            let hid = GIVEN.get(h);
            if (!hid) {
              const base = slugify(h.text) || "section", n = ids.get(base) ?? 0;
              ids.set(base, n + 1);
              hid = n ? `${base}-${n + 1}` : base;
              GIVEN.set(h, hid);
            }
            const Tag = `h${Math.min(6, h.depth + 1)}` as "h2";
            return <Tag key={k} id={hid}><Inline tokens={h.tokens} /></Tag>;
          }
          case "paragraph": {
            const p = t as Tokens.Paragraph;
            const only = (p.tokens ?? []).filter((x) => !(x.type === "text" && !x.raw.trim()));
            // A picture (or score, or recording) alone on its line stands on its own rather than inside a paragraph.
            if (only.length === 1 && only[0].type === "image") return <Embed key={k} href={(only[0] as Tokens.Image).href} text={(only[0] as Tokens.Image).text} />;
            if (only.length === 1 && only[0].type === "link" && youtube((only[0] as Tokens.Link).href)) return <Embed key={k} href={(only[0] as Tokens.Link).href} text="" />;
            if (only.length === 1 && only[0].type === "math" && (only[0] as unknown as MathToken).block) return <Tex key={k} tex={(only[0] as unknown as MathToken).text} block />;
            return <p key={k}><Inline tokens={p.tokens} /></p>;
          }
          case "text":
            return <Inline key={k} tokens={(t as Tokens.Text).tokens ?? [t]} />;
          case "math":
            return <Tex key={k} tex={(t as unknown as MathToken).text} block />;
          case "list": {
            const list = t as Tokens.List;
            const Tag = list.ordered ? "ol" : "ul";
            return (
              <Tag key={k} start={list.ordered && list.start !== 1 && list.start !== "" ? Number(list.start) : undefined}>
                {list.items.map((item, n) => (
                  <li key={n} data-task={item.task ? (item.checked ? "done" : "todo") : undefined}>
                    <Blocks tokens={item.tokens} ids={ids} />
                  </li>
                ))}
              </Tag>
            );
          }
          case "blockquote": {
            const q = t as Tokens.Blockquote;
            const first = q.tokens[0];
            const mark = first?.type === "paragraph" ? /^\[!(\w+)\][ \t]*([^\n]*)\n?/.exec((first as Tokens.Paragraph).text) : null;
            if (mark && CALLOUTS[mark[1].toLowerCase()]) {
              const kind = mark[1].toLowerCase();
              // Take the marker (and any title after it) off the front, and read the rest again as its own text.
              const rest = q.text.replace(/^\[!\w+\][ \t]*[^\n]*\n?/, "");
              return (
                <aside key={k} className="nb-callout" data-kind={kind}>
                  <b>
                    {CALLOUTS[kind]}
                    {mark[2] && <span> · <Inline tokens={parser.Lexer.lexInline(mark[2], parser.defaults)} /></span>}
                  </b>
                  <Blocks tokens={lex(rest)} ids={ids} />
                </aside>
              );
            }
            return <blockquote key={k}><Blocks tokens={q.tokens} ids={ids} /></blockquote>;
          }
          case "code": {
            const code = t as Tokens.Code;
            const lang = (code.lang ?? "").trim().toLowerCase();
            if (lang === "diagram") return <Diagram key={k} source={code.text} />;
            if (lang === "cards") return <CardsBlock key={k} source={code.text} />;
            if (lang === "demo") return <Demo key={k} source={code.text} />;
            if (lang === "math" || lang === "latex" || lang === "tex") return <Tex key={k} tex={code.text} block />;
            return <pre key={k} data-lang={lang || undefined}><code>{code.text}</code></pre>;
          }
          case "hr":
            return <hr key={k} />;
          case "table": {
            const table = t as Tokens.Table;
            return (
              <div key={k} className="nb-table">
                <table>
                  <thead>
                    <tr>
                      {table.header.map((cell, n) => (
                        <th key={n} style={{ textAlign: table.align[n] ?? undefined }}><Inline tokens={cell.tokens} /></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, n) => (
                          <td key={n} style={{ textAlign: table.align[n] ?? undefined }}><Inline tokens={cell.tokens} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          case "html":
            return <p key={k}>{(t as Tokens.HTML).text}</p>; // shown as written; notes are Markdown, not HTML
          default:
            return null;
        }
      })}
    </>
  );
}

export function Markdown({ source, className = "" }: { source: string; className?: string }) {
  const tokens = useMemo(() => lex(source), [source]);
  return (
    <div className={`nb-md ${className}`}>
      <Blocks tokens={tokens} ids={new Map()} />
    </div>
  );
}
// A line of Markdown with no blocks in it: for a card's face, a summary.
export function InlineMarkdown({ source }: { source: string }) {
  const tokens = useMemo(() => parser.Lexer.lexInline(source, parser.defaults), [source]);
  return <Inline tokens={tokens} />;
}
