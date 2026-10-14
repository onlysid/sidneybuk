"use client";

import { Pill } from "@/components/Pill";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Card } from "@/lib/learning";
import { InlineMarkdown } from "./Markdown";

// Cards are one of the ways a topic is written up: the handful of things worth knowing by heart, each as a question and its answer.
const idOf = (card: Card) => `${card[0]}|${card[1]}`;

// "Hear it" is only offered when this device has a voice that really speaks the language.
function useVoice(lang?: string) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (!lang || typeof speechSynthesis === "undefined") return;
    const want = lang.toLowerCase().replace("_", "-"), base = want.split("-")[0];
    const find = () => {
      const all = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace("_", "-").split("-")[0] === base);
      // The exact accent first, then the better-made voices.
      const score = (v: SpeechSynthesisVoice) => (v.lang.toLowerCase().replace("_", "-") === want ? 4 : 0) + (/premium|enhanced|natural|neural|siri|google/i.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0);
      setVoice(all.sort((a, b) => score(b) - score(a))[0] ?? null);
    };
    find();
    speechSynthesis.addEventListener?.("voiceschanged", find);
    return () => speechSynthesis.removeEventListener?.("voiceschanged", find);
  }, [lang]);
  return voice;
}
function speak(text: string, voice: SpeechSynthesisVoice) {
  try {
    const say = new SpeechSynthesisUtterance(text.replace(/[*_$`]/g, ""));
    say.voice = voice;
    say.lang = voice.lang;
    say.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(say);
  } catch {
    // No speech in this browser.
  }
}
const Speaker = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 9.500v5h3.500l4.500 4v-13l-4.500 4z" fill="currentColor" stroke="none" />
    <path d="M15.500 9a4.200 4.200 0 0 1 0 6M18 6.500a7.800 7.800 0 0 1 0 11" />
  </svg>
);

// The deck, with its groups (if the cards have any) to choose between: all of them, or one set at a time.
export function Deck({ cards, voice }: { cards: Card[]; voice?: string }) {
  const groups = useMemo(() => [...new Set(cards.map((c) => c[2] ?? "").filter(Boolean))], [cards]);
  const [group, setGroup] = useState<string | null>(null);
  const loose = cards.filter((c) => !c[2]).length;
  const active = useMemo(() => (group === null || !groups.includes(group) && group !== "" ? cards : cards.filter((c) => (c[2] ?? "") === group)), [cards, group, groups]);
  return (
    <>
      {groups.length > 0 && (
        <div className="sp-chips nb-deck-groups" role="group" aria-label="Which cards">
              <Pill />
          <button type="button" className="sp-chip" aria-pressed={group === null} onClick={() => setGroup(null)}>
            Everything <em>{cards.length}</em>
          </button>
          {groups.map((g) => (
            <button key={g} type="button" className="sp-chip" aria-pressed={group === g} onClick={() => setGroup(g)}>
              {g} <em>{cards.filter((c) => c[2] === g).length}</em>
            </button>
          ))}
          {loose > 0 && (
            <button type="button" className="sp-chip" aria-pressed={group === ""} onClick={() => setGroup("")}>
              The rest <em>{loose}</em>
            </button>
          )}
        </div>
      )}
      <DeckOf cards={active} voice={voice} />
    </>
  );
}

function DeckOf({ cards, voice: lang }: { cards: Card[]; voice?: string }) {
  const voice = useVoice(lang);
  const [queue, setQueue] = useState<Card[]>(cards); // what is left of this round, the card on top first
  const [missed, setMissed] = useState<Card[]>([]); // set aside, to come round again
  const [known, setKnown] = useState(0);
  const [shown, setShown] = useState(false);
  const [flip, setFlip] = useState(false); // ask from the answer side instead
  const [find, setFind] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const began = useRef(false);

  const start = (list: Card[]) => {
    setQueue(list);
    setMissed([]);
    setKnown(0);
    setShown(false);
  };
  // A different deck (another topic, or the notes changed): start again.
  const all = useMemo(() => cards.map(idOf).join("\n"), [cards]);
  useEffect(() => {
    start(cards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);
  const shuffle = () => start([...cards].sort(() => Math.random() - 0.5));
  const answer = (knew: boolean) => {
    const [card, ...rest] = queue;
    if (!card) return;
    began.current = true;
    const again = knew ? missed : [...missed, card];
    if (knew) setKnown((n) => n + 1);
    setShown(false);
    // The round is over: whatever was set aside becomes the next round.
    if (!rest.length && again.length) {
      setQueue(again);
      setMissed([]);
    } else {
      setQueue(rest);
      setMissed(again);
    }
  };
  // The answer brings the buttons with it: keep them clear of the bar at the bottom of the screen.
  useEffect(() => {
    if (shown && began.current) box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [shown]);

  // Once the answer is showing, the card can be thrown: right if you knew it, left if not.
  const lean = useRef<{ x: number; dx: number; el: HTMLElement } | null>(null);
  const rest = (el: HTMLElement) => ((el.style.translate = ""), (el.style.rotate = ""), (el.dataset.lean = ""));
  const throwing = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (!shown || e.pointerType === "mouse") return;
      lean.current = { x: e.clientX, dx: 0, el: e.currentTarget };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const l = lean.current;
      if (!l) return;
      l.dx = e.clientX - l.x;
      if (Math.abs(l.dx) < 8) return;
      l.el.style.transition = "none";
      l.el.style.translate = `${l.dx}px 0`;
      l.el.style.rotate = `${l.dx / 28}deg`;
      l.el.dataset.lean = l.dx > 60 ? "good" : l.dx < -60 ? "again" : "";
    },
    onPointerUp: () => {
      const l = lean.current;
      if (!l) return;
      lean.current = null;
      l.el.style.transition = "";
      if (Math.abs(l.dx) > 90) return answer(l.dx > 0);
      rest(l.el);
    },
    onPointerCancel: () => {
      const l = lean.current;
      lean.current = null;
      if (l) rest(l.el);
    },
  };

  const card = queue[0];
  const front = card ? card[flip ? 1 : 0] : "", back = card ? card[flip ? 0 : 1] : "";
  const words = find.toLowerCase().split(/\s+/).filter(Boolean);
  const listed = cards.filter((c) => words.every((w) => `${c[0]} ${c[1]}`.toLowerCase().includes(w)));

  if (!cards.length) return null;
  return (
    <div className="nb-deck">
      <div
        className="nb-study glass"
        ref={box}
        tabIndex={0}
        aria-label="Cards. Space turns the card over; then the right arrow if you knew it, the left arrow if not."
        onKeyDown={(e) => {
          if ((e.target as HTMLElement).tagName === "INPUT") return;
          if (!card) return;
          if (!shown && (e.key === " " || e.key === "Enter") && (e.target as HTMLElement).tagName !== "BUTTON") (e.preventDefault(), setShown(true));
          else if (shown && (e.key === "ArrowRight" || e.key === "2")) (e.preventDefault(), answer(true));
          else if (shown && (e.key === "ArrowLeft" || e.key === "1")) (e.preventDefault(), answer(false));
        }}
      >
        <div className="nb-study-top mono">
          <span>{card ? `${queue.length} to go${missed.length ? ` · ${missed.length} to come round again` : ""}` : `All ${cards.length} done`}</span>
          <span className="nb-study-tools">
            <label className="nb-flip">
              <input type="checkbox" checked={flip} onChange={(e) => (setFlip(e.target.checked), setShown(false))} />
              Answers first
            </label>
            <button type="button" onClick={shuffle}>
              Shuffle
            </button>
          </span>
          <i className="nb-study-bar" aria-hidden="true">
            <i style={{ transform: `scaleX(${known / cards.length})` }} />
          </i>
        </div>
        {card ? (
          <>
            <button type="button" className="nb-card" data-shown={shown} data-nowrap key={idOf(card) + queue.length + missed.length} onClick={() => setShown(!shown)} aria-label={shown ? "Turn the card back" : "Turn the card over"} {...throwing}>
              <span className="nb-card-inner">
                <span className="nb-face" aria-hidden={shown}>
                  <i className="nb-face-tag mono">{flip ? "Answer" : "Question"}</i>
                  <span className="nb-card-front">
                    <InlineMarkdown source={front} />
                  </span>
                </span>
                <span className="nb-face nb-face-back" aria-hidden={!shown}>
                  <i className="nb-face-tag mono">{front.replace(/[*_$`]/g, "")}</i>
                  <span className="nb-card-back">
                    <InlineMarkdown source={back} />
                  </span>
                </span>
              </span>
            </button>
            <p className="nb-card-hint mono">{shown ? <span className="nb-swipe">Swipe right if you knew it, left if not. </span> : null}{shown ? "Tap the card to turn it back." : "Tap the card to turn it over."}</p>
            {voice && (
              <button type="button" className="nb-say mono" onClick={() => speak(card[0], voice)}>
                <Speaker />
                Hear it
              </button>
            )}
            {shown ? (
              <div className="nb-grades" role="group" aria-label="Did you know it?">
                <button type="button" data-how="0" onClick={() => answer(false)}>
                  <b>Not yet</b>
                  <small>comes round again</small>
                </button>
                <button type="button" data-how="2" onClick={() => answer(true)}>
                  <b>Knew it</b>
                  <small>next card</small>
                </button>
              </div>
            ) : (
              <div className="nb-grades">
                <button type="button" data-how="show" onClick={() => setShown(true)}>
                  <b>Turn it over</b>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="nb-card nb-card-done" data-shown="true">
            <span className="nb-card-front">That is all of them.</span>
            <span className="nb-grades">
              <button type="button" data-how="show" onClick={() => start(cards)}>
                <b>From the top</b>
              </button>
            </span>
          </div>
        )}
      </div>
      <div className="nb-all" data-open={listOpen}>
        <button type="button" className="nb-all-head" data-nowrap aria-expanded={listOpen} onClick={() => setListOpen((v) => !v)}>
          <span>All {cards.length} cards, as a list</span>
          <i aria-hidden />
        </button>
        <div className="nb-all-body" inert={!listOpen}>
          <div>
            {cards.length > 10 && <input type="search" className="nb-find" placeholder="Find a card" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Find a card" />}
            <ul>
              {listed.map((c) => (
                <li key={idOf(c)}>
                  <span>
                    <InlineMarkdown source={c[0]} />
                  </span>
                  <span>
                    <InlineMarkdown source={c[1]} />
                  </span>
                  {voice && (
                    <button type="button" aria-label={`Hear ${c[0]}`} onClick={() => speak(c[0], voice)}>
                      <Speaker />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Cards written inside a note: shown where they are written, to turn over one at a time.
export function CardsBlock({ source }: { source: string }) {
  const cards = useMemo(() => source.split("\n").map((line) => line.split("::").map((s) => s.trim())).filter((p) => p.length >= 2 && p[0] && p[1]) as [string, string][], [source]);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  if (!cards.length) return null;
  return (
    <div className="nb-inline-cards">
      {cards.map((c, k) => (
        <button key={k} type="button" className="nb-mini" data-open={!!open[k]} onClick={() => setOpen({ ...open, [k]: !open[k] })} aria-expanded={!!open[k]}>
          <span>
            <InlineMarkdown source={c[0]} />
          </span>
          <span className="nb-mini-back">{open[k] ? <InlineMarkdown source={c.slice(1).join(" :: ")} /> : <i className="mono">Tap for the answer</i>}</span>
        </button>
      ))}
    </div>
  );
}
