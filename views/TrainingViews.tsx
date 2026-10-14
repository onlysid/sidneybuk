"use client";

import { Pill } from "@/components/Pill";
import { useLive } from "@/lib/live";
import { Empty } from "@/components/Empty";
import { useEffect, useMemo, useRef, useState } from "react";
import { useContent, useSite } from "@/components/Content";
import { Footer } from "@/components/Footer";
import { useMore } from "@/components/More";
import { Bars, Choice, Line, Num, UnitToggle, useUnits, type Point } from "@/components/Sport";
import { TLink } from "@/components/Transition";
import { counted, dated, lastOf, numberOf, say, sessions, type Lift } from "@/lib/gym";
import { bestsOf, FEELS, paceOf, quarterMonths, SPANS, spanKey, spanName, spansOf, spanTick, statsOf, TYPES, typeName, type RunLog, type Span } from "@/lib/runlog";
import { clock, dayOf, dist, height, hours, rate, shortDay } from "@/lib/sport";
import { padelResult, padelStats, rideStats, scoreOf, type PadelSession, type RideSession } from "@/lib/training";

// The two logs I keep myself: every run, a quarter at a time (it began as a spreadsheet), and what I lift at the gym (it began as a note on my phone).
const d = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as React.CSSProperties;
const km = (v: number, places = 2) => v.toLocaleString("en-GB", { minimumFractionDigits: places, maximumFractionDigits: places });
const long = (seconds: number) => {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`;
};

// ---- The run log, fetched once and shared -----------------------------------------------------------------------
function useLog() {
  const { data, failed } = useLive<RunLog>("/api/sport/log", { every: 60 });
  return { log: data, failed };
}

function Feel({ value }: { value?: number }) {
  if (!value) return null;
  return (
    <span className="rl-feel" title={`Felt: ${FEELS[value - 1].toLowerCase()}`} aria-label={`Felt ${FEELS[value - 1].toLowerCase()}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} data-on={n <= value} />
      ))}
    </span>
  );
}

// How this stretch compares with the one before it: "+12%", "8 s faster".
function Delta({ now, was, pace = false }: { now: number; was: number; pace?: boolean }) {
  if (!(now > 0) || !(was > 0)) return null;
  if (pace) {
    const by = Math.round(was - now);
    if (!by) return <i className="rl-delta">same as before</i>;
    return (
      <i className="rl-delta" data-way={by > 0 ? "up" : "down"}>
        {Math.abs(by)} s {by > 0 ? "faster" : "slower"}
      </i>
    );
  }
  const by = Math.round(((now - was) / was) * 100);
  return (
    <i className="rl-delta" data-way={by > 0 ? "up" : by < 0 ? "down" : undefined}>
      {by > 0 ? "+" : ""}
      {by}% on the one before
    </i>
  );
}

// /sport/log
export function RunLogView() {
  const { log, failed } = useLog();
  const runs = useMemo(() => log?.runs ?? [], [log]);
  const [span, setSpan] = useState<Span>("quarter");
  const keys = useMemo(() => spansOf(runs, span), [runs, span]);
  const [chosen, setChosen] = useState("");
  const q = chosen && keys.includes(chosen) ? chosen : (keys[keys.length - 1] ?? "");
  const at = keys.indexOf(q);
  const mine = useMemo(() => runs.filter((r) => spanKey(r.date, span) === q), [runs, q, span]);
  const before = useMemo(() => runs.filter((r) => spanKey(r.date, span) === keys[at - 1]), [runs, keys, at, span]);
  const s = useMemo(() => statsOf(mine), [mine]);
  const p = useMemo(() => statsOf(before), [before]);
  // As the spreadsheet had it: the year's distance up to the end of this stretch, and the best times so far.
  const soFar = useMemo(() => runs.filter((r) => spanKey(r.date, span) <= q), [runs, q, span]);
  const year = (mine[0]?.date ?? q).slice(0, 4);
  const yearKm = soFar.filter((r) => r.date.startsWith(year)).reduce((a, r) => a + r.km, 0);
  const bests = useMemo(() => bestsOf(soFar), [soFar]);
  const perSpan = useMemo(() => {
    const sum = new Map<string, number>();
    for (const r of runs) sum.set(spanKey(r.date, span), (sum.get(spanKey(r.date, span)) ?? 0) + r.km);
    return keys.map((k) => ({ k, km: sum.get(k) ?? 0 }));
  }, [keys, runs, span]);
  const most = Math.max(1, ...perSpan.map((x) => x.km));
  const pace: Point[] = mine.map((r) => ({ label: `${Number(r.date.slice(8))}/${Number(r.date.slice(5, 7))}`, long: shortDay(r.date), value: r.km >= 1 ? paceOf(r) : null, say: `${clock(paceOf(r))} /km over ${km(r.km)} km${r.type ? `, ${typeName(r.type).toLowerCase()}` : ""}` }));
  const newest = [...mine].reverse();
  const [rows, more] = useMore(newest, 40);
  const kinds = TYPES.map(([letter, name]) => ({ letter, name, n: mine.filter((r) => r.type === letter).length })).filter((x) => x.n);
  const typed = kinds.reduce((n, x) => n + x.n, 0);
  const name = spanName(q, span);
  // Keep the chosen stretch in sight in the row of bars (there are usually more bars than fit).
  const bars = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = bars.current, el = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (row && el) row.scrollTo({ left: el.offsetLeft - row.clientWidth / 2 + el.offsetWidth / 2, behavior: "smooth" });
  }, [q, log, span]);
  const inNew = (date: string) => spanKey(date, span) === q;

  return (
    <main className="page" data-kind="sport">
      <section className="wrap d-hero mu-fun-hero">
        <div className="d-copy">
          <p className="mono rise">
            <TLink href="/">Home</TLink> / <TLink href="/sport">Sport and fitness</TLink> / Run log
          </p>
          <h1 className="rise" style={d(80)}>
            <span className="name">Run log</span>
          </h1>
          <p className="lede rise" style={d(160)}>
            Every run, by the week, month, quarter or year: what kind of run it was, how it went, and what it added up to.
          </p>
        </div>
      </section>

      <section className="wrap section">
        {!log ? (
          <p className="sp-small">{failed ? "The log could not be loaded just now." : "Loading the log…"}</p>
        ) : !log.runs.length ? (
          <Empty title="No runs yet">Each run shows here once it arrives from Strava, with its averages and best times worked out by themselves.</Empty>
        ) : (
          <div className="rl-board">
            <div className="sp-panel glass rl-panel">
              <Choice label="Show by" value={span} options={SPANS} onChange={(v) => (setSpan(v as Span), setChosen(""))} />
              <div className="rl-quarters" ref={bars} data-span={span} role="group" aria-label={`Distance by ${span}`} key={span}>
                {perSpan.map((x) => {
                  const [tick, sub] = spanTick(x.k, span);
                  return (
                    <button key={x.k} type="button" className="rl-quarter" aria-pressed={x.k === q} onClick={() => setChosen(x.k)} aria-label={`${spanName(x.k, span)}: ${Math.round(x.km)} km`} title={`${spanName(x.k, span)}: ${km(x.km, 1)} km`}>
                      <i style={{ height: `${x.km ? Math.max(4, (x.km / most) * 100) : 0}%` }} />
                      <span className="mono">
                        {tick}
                        <em>{sub}</em>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="rl-head">
                <button type="button" className="rl-step" disabled={at <= 0} onClick={() => setChosen(keys[at - 1])} aria-label={`The ${span} before`}>
                  ‹
                </button>
                <div key={q}>
                  <b>{name}</b>
                  <span className="mono">
                    {span === "quarter" ? `${quarterMonths(q)} · ` : ""}
                    {span === "year" ? `${km(s.km, 0)} km all year` : `${year} so far: ${km(yearKm)} km`}
                  </span>
                </div>
                <button type="button" className="rl-step" disabled={at >= keys.length - 1} onClick={() => setChosen(keys[at + 1])} aria-label={`The ${span} after`}>
                  ›
                </button>
              </div>
            </div>

            <div className="rl-hero">
              <div className="rl-big glass" data-lead>
                <span className="mono">Distance</span>
                <b>
                  <Num value={s.km} say={(v) => km(v, 1)} />
                  <small>km</small>
                </b>
                <Delta now={s.km} was={p.km} />
              </div>
              <div className="rl-big glass">
                <span className="mono">Runs</span>
                <b>
                  <Num value={s.count} say={(v) => String(Math.round(v))} />
                </b>
                <Delta now={s.count} was={p.count} />
              </div>
              <div className="rl-big glass">
                <span className="mono">Time on my feet</span>
                <b>
                  <Num value={s.time} say={long} />
                </b>
                <Delta now={s.time} was={p.time} />
              </div>
            </div>

            <div className="rl-cols">
              <div className="rl-card glass">
                <span className="mono">Pace, per km</span>
                <div className="rl-pair">
                  <div>
                    <b>{s.avgPace ? <Num value={s.avgPace} say={clock} /> : "–"}</b>
                    <span>average</span>
                    <Delta now={s.avgPace} was={p.avgPace} pace />
                  </div>
                  <div>
                    <b>{s.bestPace ? <Num value={s.bestPace} say={clock} /> : "–"}</b>
                    <span>quickest run</span>
                  </div>
                </div>
              </div>
              <div className="rl-card glass">
                <span className="mono">Kinds of run</span>
                {typed ? (
                  <>
                    <div className="rl-mix" role="img" aria-label={kinds.map((x) => `${x.n} ${x.name.toLowerCase()}`).join(", ")}>
                      {kinds.map((x) => (
                        <i key={x.letter} data-type={x.letter} style={{ flexGrow: x.n }} title={`${x.name}: ${x.n}`} />
                      ))}
                    </div>
                    <p className="rl-mix-key">
                      {kinds.map((x) => (
                        <span key={x.letter}>
                          <i className="rl-type" data-type={x.letter}>
                            {x.letter}
                          </i>
                          {x.name} <b>{x.n}</b>
                        </span>
                      ))}
                    </p>
                  </>
                ) : (
                  <div className="rl-pair">
                    <div>
                      <b>{s.count}</b>
                      <span>{s.count === 1 ? "run" : "runs"}, from before I wrote the kind down</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rl-minis">
              {(
                [
                  ["Average run", s.count ? `${km(s.avgKm)} km` : "–"],
                  ["Average time", s.count ? clock(s.avgTime) : "–"],
                  ["Furthest", s.count ? `${km(s.furthest)} km` : "–"],
                  ["Heart rate", s.hr ? `${Math.round(s.hr)} bpm` : "–"],
                  ["Cadence", s.cadence ? `${Math.round(s.cadence)} spm` : "–"],
                  ...(s.easy !== null ? [["Easy runs", `${Math.round(s.easy * 100)}%`]] : []),
                  ...(s.feel !== null ? [["Felt, of 5", s.feel.toFixed(1)]] : []),
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label} className="rl-mini glass">
                  <span className="mono">{label}</span>
                  <b key={value}>{value}</b>
                </div>
              ))}
            </div>

            {pace.filter((x) => x.value !== null).length > 1 && (
              <div className="sp-panel glass" key={`${span}${q}`}>
                <Line points={pace} name="Pace, run by run" axis={clock} flip />
              </div>
            )}
          </div>
        )}
      </section>

      {bests.length > 0 && (
        <section className="wrap section">
          <div className="section-head">
            <h2>Best times</h2>
            <span className="mono">As they stood at the end of {name}</span>
          </div>
          <div className="rl-bests">
            {bests.map((b) => (
              <TLink key={b.key} href={`/sport/activities/${b.id}`} className="rl-best glass" data-new={inNew(b.date)}>
                <span className="mono">{b.name}</span>
                <b>{clock(b.time)}</b>
                <span className="rl-best-foot">
                  {inNew(b.date) && <i className="post-tag">New this {span}</i>}
                  <span>{dayOf(b.date).replace(/^\w+ /, "")}</span>
                  <span className="mono">Within 10%: {clock(b.time * 1.1)}</span>
                </span>
              </TLink>
            ))}
          </div>
        </section>
      )}

      {log && log.runs.length > 0 && (
        <section className="wrap section">
          <div className="section-head">
            <h2>The runs</h2>
            <span className="mono">
              {mine.length} in {name}, newest first
            </span>
          </div>
          <div className="rl-table" key={`${span}${q}`} role="table" aria-label={`Runs in ${name}`}>
            <div className="rl-row rl-row-head mono" role="row">
              <span role="columnheader">Date</span>
              <span role="columnheader">Distance</span>
              <span role="columnheader">Time</span>
              <span role="columnheader">Pace</span>
              <span role="columnheader">HR</span>
              <span role="columnheader">Cadence</span>
              <span role="columnheader">Type</span>
              <span role="columnheader">Notable</span>
            </div>
            {rows.map((r) => (
              <TLink key={r.id} href={`/sport/activities/${r.id}`} className="rl-row glass" role="row">
                <span className="rl-date mono" role="cell">
                  {shortDay(r.date)}
                  {span === "year" ? "" : ""}
                </span>
                <b role="cell" data-label="km">
                  {km(r.km)}
                </b>
                <span role="cell" data-label="time">
                  {clock(r.time)}
                </span>
                <span role="cell" data-label="/km">
                  {clock(paceOf(r))}
                </span>
                <span role="cell" data-label="bpm">
                  {r.hr ?? "–"}
                </span>
                <span role="cell" data-label="spm">
                  {r.cadence ?? "–"}
                </span>
                <span role="cell" className="rl-type-cell">
                  {r.type ? (
                    <i className="rl-type" data-type={r.type} title={typeName(r.type)}>
                      {r.type}
                    </i>
                  ) : null}
                  <Feel value={r.feel} />
                </span>
                <span role="cell" className="rl-note">
                  {r.efforts && <em className="mono">{r.efforts}</em>}
                  {r.note}
                </span>
              </TLink>
            ))}
          </div>
          {more}
        </section>
      )}

      <section className="wrap section">
        <div className="rl-more">
          <TLink href="/sport/gym" className="btn btn-ghost small">
            The gym log
          </TLink>
          <TLink href="/sport" className="btn btn-ghost small">
            Back to sport and fitness
          </TLink>
        </div>
      </section>
      <Footer />
    </main>
  );
}

// ---- The gym ------------------------------------------------------------------------------------------------------
const RANGES: [string, string, number][] = [["all", "All time", 0], ["year", "12 months", 365], ["quarter", "3 months", 92], ["month", "Month", 31]];
// One machine: where it is, how far it has come in the chosen stretch of time, and every step drawn.
function LiftCard({ lift, since, k }: { lift: Lift; since: string; k: number }) {
  const inRange = dated(lift).filter((e) => !since || e.date >= since);
  const last = lastOf(lift);
  const nums = inRange.map((e) => ({ e, v: numberOf(e.value) })).filter((x): x is { e: (typeof inRange)[number]; v: number } => x.v !== null);
  const first = nums[0]?.v, now = nums[nums.length - 1]?.v;
  const by = first !== undefined && now !== undefined ? now - first : 0;
  const points: Point[] = nums.map(({ e, v }) => ({ label: `${Number(e.date.slice(8))}/${Number(e.date.slice(5, 7))}`, long: `${shortDay(e.date)} ${e.date.slice(0, 4)}`, value: v, say: say(lift, e.value) }));
  const quiet = since && !inRange.length; // nothing in this stretch: it stands where it stood
  return (
    <article className="gy-card glass rise" style={d(60 + k * 40)} data-quiet={!!quiet}>
      <header>
        <h3>{lift.title}</h3>
        {counted(lift) && by !== 0 && (
          <span className="gy-up mono" data-way={by > 0 ? "up" : "down"}>
            {by > 0 ? "+" : ""}
            {Math.round(by * 100) / 100} {lift.unit}
          </span>
        )}
      </header>
      <p className="gy-now">
        <b data-words={!counted(lift)}>{last ? last.value : "–"}</b>
        {last && counted(lift) && <span>{lift.unit}</span>}
      </p>
      {points.length > 1 ? (
        <div className="gy-chart">
          <Line points={points} name={since ? "In this time" : "Every time"} axis={(v) => String(Math.round(v * 10) / 10)} />
        </div>
      ) : (
        counted(lift) &&
        last && (
          <div className="gy-flat" aria-hidden="true">
            <i />
          </div>
        )
      )}
      <p className="gy-foot mono">
        {!last
          ? "Not done yet"
          : quiet
            ? `Not done in this time · stands at ${say(lift, last.value)}`
            : !counted(lift)
              ? `${inRange.length} ${inRange.length === 1 ? "time" : "times"}`
              : points.length > 1
                ? `From ${say(lift, String(first))} · ${points.length} entries`
                : `Held at ${say(lift, last.value)}`}
        {last?.date && ` · last ${shortDay(last.date)}`}
      </p>
      {lift.note && <p className="gy-note">{lift.note}</p>}
    </article>
  );
}

// /sport/gym
export function GymView() {
  const { lifts } = useContent();
  const { sport } = useSite();
  const [range, setRange] = useState("all");
  const days = useMemo(() => sessions(lifts), [lifts]);
  const [shownDays, moreDays] = useMore(days, 8);
  const span = RANGES.find((r) => r[0] === range) ?? RANGES[0];
  // The first day of the chosen stretch, counted back from today ("" for all time).
  const since = useMemo(() => {
    if (!span[2]) return "";
    const from = new Date();
    from.setDate(from.getDate() - span[2]);
    return `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
  }, [span]);
  const inTime = days.filter((x) => !since || x.date >= since);
  const gains = lifts
    .map((l) => {
      const nums = dated(l).filter((e) => !since || e.date >= since).map((e) => numberOf(e.value)).filter((n): n is number => n !== null);
      return counted(l) && nums.length > 1 && nums[0] ? (nums[nums.length - 1] - nums[0]) / nums[0] : null;
    })
    .filter((g): g is number => g !== null);
  const average = gains.length ? gains.reduce((a, g) => a + g, 0) / gains.length : 0;
  const total = lifts.reduce((n, l) => n + (counted(l) ? (numberOf(lastOf(l)?.value) ?? 0) : 0), 0);
  return (
    <main className="page" data-kind="sport">
      <section className="wrap d-hero mu-fun-hero">
        <div className="d-copy">
          <p className="mono rise">
            <TLink href="/">Home</TLink> / <TLink href="/sport">Sport and fitness</TLink> / Gym
          </p>
          <h1 className="rise" style={d(80)}>
            <span className="name">Gym</span>
          </h1>
          <p className="lede rise" style={d(160)}>
            The same machines each visit, and the weight on each written down after every session so I can watch it go up.
          </p>
          {sport.gymPlan && (
            <p className="gy-plan rise" style={d(220)}>
              {sport.gymPlan.split(/\s*[·,]\s*/).filter(Boolean).map((part) => (
                <span key={part} className="post-tag">
                  {part}
                </span>
              ))}
            </p>
          )}
        </div>
      </section>

      <section className="wrap section">
        {!days.length && (
          <div className="gy-none glass">
            <span className="mono">Nothing written up yet</span>
            <p>The numbers and charts here are built from gym sessions as I write them up, starting with the first one.</p>
          </div>
        )}
        <div className="gy-range" hidden={!days.length}>
          <Choice label="Over" value={range} options={RANGES.map(([v, name]) => [v, name] as const)} onChange={setRange} />
        </div>
        <div className="rl-hero gy-hero" key={range} hidden={!days.length}>
          <div className="rl-big glass" data-lead>
            <span className="mono">{since ? "Gained in this time" : "Gained since the start"}</span>
            <b>
              {gains.length ? `${average >= 0 ? "+" : ""}${Math.round(average * 100)}` : "0"}
              <small>%</small>
            </b>
            <i className="rl-delta">{gains.length ? `on average, across ${gains.length} ${gains.length === 1 ? "machine" : "machines"}` : "no weight has changed in this time"}</i>
          </div>
          <div className="rl-big glass">
            <span className="mono">{since ? "Visits in this time" : "Visits logged"}</span>
            <b>{inTime.length}</b>
            <i className="rl-delta">{days[0] ? `last on ${shortDay(days[0].date)}` : "counted from the first session logged"}</i>
          </div>
          <div className="rl-big glass">
            <span className="mono">All the machines, added up</span>
            <b>
              {Math.round(total).toLocaleString("en-GB")}
              <small>kg</small>
            </b>
            <i className="rl-delta">
              {lifts.length} {lifts.length === 1 ? "machine" : "machines"}
            </i>
          </div>
        </div>
      </section>

      <section className="wrap section">
        <div className="section-head">
          <h2>Machine by machine</h2>
          <span className="mono">{span[1]}: where each started, and where it is now</span>
        </div>
        <div className="gy-grid" key={range}>
          {lifts.map((lift, k) => (
            <LiftCard key={lift.slug} lift={lift} since={since} k={k} />
          ))}
        </div>
      </section>

      {days.length > 0 && (
        <section className="wrap section">
          <div className="section-head">
            <h2>Visits</h2>
            <span className="mono">Newest first</span>
          </div>
          <div className="gy-days">
            {shownDays.map((day) => (
              <div key={day.date} className="gy-day glass">
                <b>{shortDay(day.date)}</b>
                <p>
                  {day.done.map((x) => (
                    <span key={x.title}>
                      {x.title} <em>{x.value}</em>
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </div>
          {moreDays}
        </section>
      )}

      <section className="wrap section">
        <div className="rl-more">
          <TLink href="/sport/log" className="btn btn-ghost small">
            The run log
          </TLink>
          <TLink href="/sport" className="btn btn-ghost small">
            Back to sport and fitness
          </TLink>
        </div>
      </section>
      <Footer />
    </main>
  );
}

// ---- Padel --------------------------------------------------------------------------------------------------------- /sport/padel: every session,…
export function PadelView() {
  const { data, failed } = useLive<{ sessions: PadelSession[]; sample: boolean }>("/api/sport/padel", { every: 60 });
  const [kind, setKind] = useState("");
  const all = useMemo(() => data?.sessions ?? [], [data]);
  const s = useMemo(() => padelStats(all), [all]);
  const shown = all.filter((x) => !kind || (x.log.padel?.kind ?? "Not said") === kind);
  const [listed, more] = useMore(shown, 12);
  // The last ten results, oldest first, as a row of dots.
  const form = all.filter((x) => padelResult(x.log.padel?.sets)).slice(0, 10).reverse();
  return (
    <main className="page" data-kind="sport">
      <section className="wrap d-hero mu-fun-hero">
        <div className="d-copy">
          <p className="mono rise">
            <TLink href="/">Home</TLink> / <TLink href="/sport">Sport and fitness</TLink> / Padel
          </p>
          <h1 className="rise" style={d(80)}>
            <span className="name">Padel</span>
          </h1>
          <p className="lede rise" style={d(160)}>
            Every time on court: whether it was a match, a friendly or training, who with, and how the sets went.
          </p>
        </div>
      </section>

      <section className="wrap section">
        {!data ? (
          <p className="sp-small">{failed ? "Could not load just now." : "Loading…"}</p>
        ) : !data.sessions.length ? (
          <Empty title="No sessions yet">Each time on court shows here once it arrives from Strava and I have added the score.</Empty>
        ) : (
          <>
            <div className="sp-facts gy-facts">
              <div className="sp-tile glass">
                <b>{s.sessions}</b>
                <span className="mono">Sessions</span>
              </div>
              <div className="sp-tile glass">
                <b>{s.played ? `${s.won}–${s.lost}` : "–"}</b>
                <span className="mono">Won and lost</span>
              </div>
              <div className="sp-tile glass">
                <b>{s.played ? `${Math.round((s.won / s.played) * 100)}%` : "–"}</b>
                <span className="mono">Matches won</span>
              </div>
              <div className="sp-tile glass">
                <b>{s.setsWon + s.setsLost ? `${s.setsWon}–${s.setsLost}` : "–"}</b>
                <span className="mono">Sets</span>
              </div>
              <div className="sp-tile glass">
                <b>{hours(s.time)}</b>
                <span className="mono">On court</span>
              </div>
            </div>
            {form.length > 1 && (
              <p className="pdl-form">
                <span className="mono">Lately</span>
                {form.map((x) => (
                  <i key={x.id} data-outcome={padelResult(x.log.padel?.sets)} title={`${shortDay(x.date)}: ${scoreOf(x.log.padel?.sets)}`} />
                ))}
                {s.streak > 1 && <span className="post-tag">{s.streak} wins in a row</span>}
              </p>
            )}
          </>
        )}
      </section>

      {data && data.sessions.length > 0 && (
        <section className="wrap section">
          <div className="section-head">
            <h2>Sessions</h2>
            <span className="mono">{"Newest first"}</span>
          </div>
          {s.kinds.length > 1 && (
            <div className="sp-chips pdl-kinds" role="group" aria-label="Kind of session">
              <Pill />
              {[["", s.sessions] as [string, number], ...s.kinds].map(([k, n]) => (
                <button key={k} type="button" className="sp-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
                  {k || "Everything"} <em>{n}</em>
                </button>
              ))}
            </div>
          )}
          <div className="pdl-list" key={kind}>
            {listed.map((x) => {
              const result = padelResult(x.log.padel?.sets);
              return (
                <TLink key={x.id} href={`/sport/activities/${x.id}`} className="pdl-row glass" data-outcome={result ?? undefined}>
                  <span className="mono">
                    {shortDay(x.date)} {x.date.slice(0, 4)}
                    {x.log.padel?.kind && ` · ${x.log.padel.kind}`}
                  </span>
                  <b>{result ? scoreOf(x.log.padel?.sets) : (x.log.padel?.kind ?? x.name ?? "Padel")}</b>
                  <span className="pdl-row-foot">
                    {result && <i className="post-tag">{result === "won" ? "Won" : result === "lost" ? "Lost" : "Level"}</i>}
                    {x.log.padel?.partner && <span>with {x.log.padel.partner}</span>}
                    {x.log.padel?.opponents && <span>against {x.log.padel.opponents}</span>}
                    <span>{hours(x.moving)}</span>
                    <Feel value={x.log.feel} />
                  </span>
                  {x.log.note && <span className="pdl-row-note">{x.log.note}</span>}
                </TLink>
              );
            })}
            {!shown.length && <p className="sp-small">Nothing here yet.</p>}
          </div>
          {more}
        </section>
      )}

      <section className="wrap section">
        <div className="rl-more">
          <TLink href="/sport/tools" className="btn btn-ghost small">
            Padel levels, across the scales
          </TLink>
          <TLink href="/sport" className="btn btn-ghost small">
            Back to sport and fitness
          </TLink>
        </div>
      </section>
      <Footer />
    </main>
  );
}

// /sport/cycling: every ride, what they add up to, and the last year month by month.
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function RideView() {
  const { data, failed } = useLive<{ rides: RideSession[] }>("/api/sport/rides", { every: 60 });
  const u = useUnits();
  const [kind, setKind] = useState("");
  const [year, setYear] = useState("");
  const all = useMemo(() => data?.rides ?? [], [data]);
  const years = useMemo(() => [...new Set(all.map((r) => r.date.slice(0, 4)))].sort().reverse(), [all]);
  const inYear = useMemo(() => all.filter((r) => !year || r.date.startsWith(year)), [all, year]);
  const s = useMemo(() => rideStats(inYear), [inYear]);
  const shown = inYear.filter((r) => !kind || (r.log.ride?.kind ?? "Not said") === kind);
  const [listed, more] = useMore(shown, 12);
  // Distance for each of the last twelve months (or each month of the chosen year).
  const months = useMemo<Point[]>(() => {
    const now = new Date();
    const keys = year ? Array.from({ length: 12 }, (_, m) => `${year}-${String(m + 1).padStart(2, "0")}`) : Array.from({ length: 12 }, (_, k) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + k, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    return keys.map((key) => {
      const list = all.filter((r) => r.date.startsWith(key));
      const metres = list.reduce((n, r) => n + r.distance, 0);
      const name = `${MONTH_NAMES[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;
      return { label: MONTH_NAMES[Number(key.slice(5)) - 1], long: name, value: metres / (u === "mi" ? 1609.344 : 1000), say: list.length ? `${dist(metres, u)} over ${list.length} ${list.length === 1 ? "ride" : "rides"}` : "No rides" };
    });
  }, [all, year, u]);
  return (
    <main className="page" data-kind="sport">
      <section className="wrap d-hero mu-fun-hero">
        <div className="d-copy">
          <p className="mono rise">
            <TLink href="/">Home</TLink> / <TLink href="/sport">Sport and fitness</TLink> / Cycling
          </p>
          <h1 className="rise" style={d(80)}>
            <span className="name">Cycling</span>
          </h1>
          <p className="lede rise" style={d(160)}>
            Every ride: how far, how fast, how much climbing, and what sort of ride it was.
          </p>
        </div>
      </section>

      <section className="wrap section">
        {!data ? (
          <p className="sp-small">{failed ? "Could not load just now." : "Loading…"}</p>
        ) : !all.length ? (
          <Empty title="No rides yet">Each ride shows here once it arrives from Strava, with what it adds to the totals.</Empty>
        ) : (
          <>
            <div className="rd-top">
              <div className="sp-chips" role="group" aria-label="When">
              <Pill />
                {["", ...years].map((y) => (
                  <button key={y} type="button" className="sp-chip" aria-pressed={year === y} onClick={() => (setYear(y), setKind(""))}>
                    {y || "All time"}
                  </button>
                ))}
              </div>
              <UnitToggle />
            </div>
            <div className="sp-facts gy-facts" key={year + u}>
              <div className="sp-tile glass">
                <b>{s.rides}</b>
                <span className="mono">Rides</span>
              </div>
              <div className="sp-tile glass">
                <b>{dist(s.distance, u, 0)}</b>
                <span className="mono">Distance</span>
              </div>
              <div className="sp-tile glass">
                <b>{hours(s.moving)}</b>
                <span className="mono">In the saddle</span>
              </div>
              <div className="sp-tile glass">
                <b>{height(s.climb, u)}</b>
                <span className="mono">Climbed</span>
              </div>
              <div className="sp-tile glass">
                <b>{s.speed ? rate("Ride", s.distance, s.moving, u) : "–"}</b>
                <span className="mono">Average speed</span>
              </div>
              {s.longest && (
                <TLink href={`/sport/activities/${s.longest.id}`} className="sp-tile glass">
                  <b>{dist(s.longest.distance, u, 0)}</b>
                  <span className="mono">Longest · {shortDay(s.longest.date)}</span>
                </TLink>
              )}
            </div>
            <div className="sp-panel glass rd-chart">
              <Bars points={months} name={`Distance each month, ${year || "the last 12 months"}`} axis={(v) => `${Math.round(v)}`} />
            </div>
          </>
        )}
      </section>

      {data && all.length > 0 && (
        <section className="wrap section">
          <div className="section-head">
            <h2>Rides</h2>
            <span className="mono">Newest first</span>
          </div>
          {s.kinds.length > 1 && (
            <div className="sp-chips pdl-kinds" role="group" aria-label="Kind of ride">
              <Pill />
              {[["", s.rides] as [string, number], ...s.kinds].map(([k, n]) => (
                <button key={k} type="button" className="sp-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
                  {k || "Everything"} <em>{n}</em>
                </button>
              ))}
            </div>
          )}
          <div className="pdl-list" key={kind + year}>
            {listed.map((r) => (
              <TLink key={r.id} href={`/sport/activities/${r.id}`} className="pdl-row glass">
                <span className="mono">
                  {shortDay(r.date)} {r.date.slice(0, 4)}
                  {r.log.ride?.kind && ` · ${r.log.ride.kind}`}
                </span>
                <b>{r.distance >= 50 ? dist(r.distance, u) : hours(r.moving)}</b>
                <span className="pdl-row-foot">
                  {r.name && <i className="post-tag">{r.name}</i>}
                  <span>{hours(r.moving)}</span>
                  {r.distance >= 50 && r.moving > 0 && <span>{rate("Ride", r.distance, r.moving, u)}</span>}
                  {r.climb >= 20 && <span>↑ {height(r.climb, u)}</span>}
                  {r.watts ? <span>{r.watts} W</span> : null}
                  {r.log.ride?.bike && <span>{r.log.ride.bike}</span>}
                  {r.log.ride?.with && <span>with {r.log.ride.with}</span>}
                  <Feel value={r.log.feel} />
                </span>
                {r.log.note && <span className="pdl-row-note">{r.log.note}</span>}
              </TLink>
            ))}
            {!shown.length && <p className="sp-small">Nothing here yet.</p>}
          </div>
          {more}
        </section>
      )}
      <section className="wrap rl-foot">
        <TLink href="/sport/log" className="btn btn-glass glass small">
          The run log
        </TLink>
        <TLink href="/sport" className="btn btn-glass glass small">
          Back to sport and fitness
        </TLink>
      </section>
      <Footer />
    </main>
  );
}
