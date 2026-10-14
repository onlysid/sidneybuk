"use client";

import { useContent, useSite } from "@/components/Content";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { setSound, soundOn } from "@/lib/audio";
import data from "@/lib/github-data.json";
import { searchBooks } from "@/lib/books";
import { searchPlaces } from "@/lib/travel";
import { longDate } from "@/lib/posts";
import { currentTheme, setTheme } from "@/lib/theme";
import { disciplines, site } from "@/lib/site";
import { useGo } from "../Transition";
import { PadelGame } from "./PadelGame";

type Line = { kind: "in" | "out"; text: string };

const HELP = [
  "help         list the commands",
  "whoami       who is this",
  "skills       what I work on",
  "now          where I am and what I am working on",
  "ls           what is on this site",
  "open x       go to a page, e.g. open music",
  "posts        the latest blog posts",
  "books [word] what I am reading; add a word to search the library",
  "book <title> open a book",
  "places [word] where I have been; add a word to search the log",
  "theme x      light or dark",
  "sound x      on or off",
  "github       open my GitHub",
  "resume       open the résumé",
  "email        how to reach me",
  "play         a game of padel",
  "clear        wipe the screen",
];
const PAGES = [...disciplines.map((d) => d.slug as string), "blog", "contact", "privacy"];

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// A small pretend shell.
export function Terminal({ autoFocus = false }: { autoFocus?: boolean }) {
  const { books, posts, places } = useContent();
  const site = useSite();
  const inputId = useId();
  const go = useGo();
  const [lines, setLines] = useState<Line[]>([{ kind: "out", text: `Welcome to ${site.domain}. Type help.` }]);
  const [typing, setTyping] = useState<{ text: string; shown: number } | null>(null);
  const [value, setValue] = useState("");
  const [playing, setPlaying] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const queue = useRef<string[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  // Answers wait in a queue and are typed out one line after another.
  const say = (out: string[]) => {
    queue.current.push(...out);
    setTyping((t) => t ?? next());
  };
  const next = () => {
    const text = queue.current.shift();
    return text === undefined ? null : { text, shown: 0 };
  };
  useEffect(() => {
    if (!typing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typing.shown >= typing.text.length) {
      setLines((l) => [...l, { kind: "out", text: typing.text }]);
      setTyping(next());
      return;
    }
    // Long lines type in bigger bites, so nothing takes more than about a third of a second.
    const bite = Math.max(2, Math.ceil(typing.text.length / 18));
    const t = window.setTimeout(() => setTyping({ text: typing.text, shown: typing.shown + bite }), 16);
    return () => window.clearTimeout(t);
  }, [typing]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines, typing, playing]);

  // The screen's height follows whatever is on it (the scrollback or the court) and eases between the two.
  useIsoLayoutEffect(() => {
    const box = inner.current;
    if (!box || !stage.current) return;
    const fit = () => stage.current && (stage.current.style.height = `${box.offsetHeight}px`);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [playing]);

  // Fade the current screen out, swap, and let the new one fade in.
  const swap = (toGame: boolean, summary?: string) => {
    setLeaving(true);
    window.setTimeout(
      () => {
        setPlaying(toGame);
        setLeaving(false);
        if (summary) say([summary]);
      },
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 230,
    );
  };
  useEffect(() => {
    // Back at the prompt after a game (or on opening the overlay): focus it, but only where there is a real keyboard.
    const keyboard = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!playing && keyboard && (mounted.current || autoFocus)) input.current?.focus({ preventScroll: true });
    mounted.current = true;
  }, [playing, autoFocus]);

  const run = (raw: string) => {
    // Anything still being typed from the last command lands at once, so answers never arrive out of order.
    if (typing || queue.current.length) {
      const rest = [...(typing ? [typing.text] : []), ...queue.current];
      queue.current = [];
      setTyping(null);
      setLines((l) => [...l, ...rest.map((text) => ({ kind: "out" as const, text }))]);
    }
    const input = raw.trim();
    const [cmd, arg] = input.toLowerCase().split(/\s+/);
    let out: string[] = [];
    if (!cmd) out = [];
    else if (cmd === "help") out = HELP;
    else if (cmd === "whoami") out = [`${site.name}, ${site.role.toLowerCase()}`];
    else if (cmd === "skills") out = [site.interests.join("  ·  ")];
    else if (cmd === "ls") out = [PAGES.map((p) => p + "/").join("   ")];
    else if (cmd === "now" || cmd === "date") {
      const latest = [...data.repos].sort((x, y) => y.pushed.localeCompare(x.pushed))[0];
      const place = site.location;
      out = [
        place ? `in ${place.name}, where it is ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: place.timeZone }).format(new Date())}` : "somewhere",
        `last pushed to ${latest.name} on ${longDate(latest.pushed)}`,
      ];
    } else if (cmd === "posts") out = [...posts.slice(0, 5).map((p) => `${p.date}  ${p.title}`), "open blog to read them"];
    else if (cmd === "places" || cmd === "place") {
      const query = input.split(/\s+/).slice(1).join(" ");
      const found = searchPlaces(places, query);
      if (cmd === "place" && found.length === 1) {
        out = [`opening ${found[0].name}…`];
        window.setTimeout(() => go(`/travel/${found[0].slug}`), 450);
      } else if (!found.length) out = [`nowhere in the log matches "${query}"`];
      else out = [...found.map((p) => `${p.kind.toLowerCase().padEnd(10)}  ${p.name}, ${p.country}  (${p.entries.length} ${p.entries.length === 1 ? "entry" : "entries"})`), "place <name> opens one"];
    } else if (cmd === "books" || cmd === "book") {
      // "books" lists the shelf, "books feynman" searches it, "book dune" opens that book's page.
      const query = input.split(/\s+/).slice(1).join(" ");
      const found = searchBooks(books, query);
      const row = (b: (typeof books)[number]) => `${b.status === "reading" ? "reading" : b.status === "read" ? `read ${b.rating ? "★".repeat(b.rating).padEnd(5) : "     "}` : "next      "}  ${b.title}, ${b.author}`;
      if (cmd === "book" && !query) out = ["Which one? Try book dune."];
      else if (cmd === "book" && found.length === 1) {
        out = [`opening ${found[0].title}…`];
        window.setTimeout(() => go(`/reading/${found[0].slug}`), 450);
      } else if (!found.length) out = [`nothing on the shelves matches "${query}"`];
      else out = [...found.slice(0, 8).map(row), ...(found.length > 8 ? [`…and ${found.length - 8} more. Add a word to narrow it down.`] : []), cmd === "book" ? "More than one matches. Add another word." : query ? "book <title> opens one" : "books <word> searches; book <title> opens one"];
    }
    else if (cmd === "theme") {
      if (arg === "light" || arg === "dark") {
        setTheme(arg, { x: window.innerWidth / 2, y: window.innerHeight / 2 });
        out = [`theme is now ${arg}`];
      } else out = [`theme is ${currentTheme()}. Try theme light or theme dark.`];
    } else if (cmd === "sound") {
      if (arg === "on" || arg === "off") {
        setSound(arg === "on");
        out = [`sound is now ${arg}`];
      } else out = [`sound is ${soundOn() ? "on" : "off"}. Try sound on or sound off.`];
    } else if (cmd === "open" || cmd === "cd") {
      const page = arg?.replace(/^\/|\/$/g, "") ?? "";
      if (PAGES.includes(page)) {
        out = [`opening ${page}…`];
        window.setTimeout(() => go(`/${page}`), 450);
      } else if (page === "home" || arg === ".." || arg === "/" || arg === "~") {
        out = ["going home…"];
        window.setTimeout(() => go("/"), 450);
      } else out = [`no such page: ${arg ?? ""}. Try ls.`];
    } else if (cmd === "resume") {
      out = ["opening the résumé in a new tab…"];
      window.open(site.resumeUrl, "_blank", "noopener");
    } else if (cmd === "github") {
      out = [`opening github.com/${site.integrations.github}…`];
      window.open(`https://github.com/${site.integrations.github}`, "_blank", "noopener");
    } else if (cmd === "email") out = [site.email];
    else if (cmd === "play" || cmd === "padel") {
      setLines((l) => [...l, { kind: "in", text: input }]);
      return swap(true);
    } else if (cmd === "sudo") out = ["Nice try."];
    else if (cmd === "clear") {
      queue.current = [];
      setTyping(null);
      return setLines([]);
    }
    else out = [`command not found: ${cmd}. Try help.`];
    setLines((l) => [...l, { kind: "in", text: input }]);
    say(out);
  };

  return (
    <div className="terminal" data-lens>
      <div className="terminal-bar" aria-hidden="true">
        <span /> <span /> <span />
      </div>
      <div className="terminal-stage" ref={stage}>
        <div ref={inner} className="terminal-screen" data-leaving={leaving} key={playing ? "game" : "shell"}>
          {playing ? (
            <PadelGame onQuit={(summary) => swap(false, summary)} />
          ) : (
            <div className="terminal-body" ref={scroller} aria-live="polite">
              {lines.map((l, n) => (
                <div key={n} className={l.kind === "in" ? "t-in" : "t-out"}>
                  {l.kind === "in" && <span className="prompt">&gt; </span>}
                  {l.text}
                </div>
              ))}
              {typing && (
                <div className="t-out t-typing">
                  {typing.text.slice(0, typing.shown)}
                  <i />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <form
        className="terminal-input"
        onSubmit={(e) => {
          e.preventDefault();
          if (playing) return;
          run(value);
          setValue("");
        }}
      >
        <label htmlFor={inputId} className="prompt">
          &gt;
        </label>
        <input id={inputId} ref={input} value={playing ? "" : value} onChange={(e) => !playing && setValue(e.target.value)} readOnly={playing} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={playing ? "Q to quit" : "help"} aria-label="Command" />
        <button type="submit">Run</button>
      </form>
    </div>
  );
}
