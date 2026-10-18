"use client";

import { Pic } from "@/components/Pic";
import { Pill } from "@/components/Pill";
import { Empty } from "@/components/Empty";
import { useEffect, useMemo, useState } from "react";
import { useContent, useSite } from "@/components/Content";
import { Footer } from "@/components/Footer";
import { MorePosts } from "@/components/More";
import { ActivityRow, Bars, Choice, Line, Num, Pick, RouteMap, UnitToggle, useSummary, useUnits, type Point } from "@/components/Sport";
import { TLink } from "@/components/Transition";
import { Pace, Reaction } from "@/components/toys/SportLab";
import { Bmi, PadelLevels, Vo2Max } from "@/components/toys/SportTools";
import { say as sayLift } from "@/lib/gym";
import { FEELS, typeName } from "@/lib/runlog";
import { padelResult, scoreOf } from "@/lib/training";
import { METRIC_INFO, clock, dayOf, dist, goalProgress, height, hours, kindOf, rate, rateWord, sportName, timeOf, weight, type Activity, type ActivityDetail, type Bucket, type HealthSeries, type Metric, type Units } from "@/lib/sport";
import { useLive } from "@/lib/live";

const d = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as React.CSSProperties;
const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const longDay = (day: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(day + "T00:00:00Z"));

// The stretches of time a chart is cut into: the last twelve months, the months of one year, or every year.
type Period = { label: string; long: string; has: (month: string) => boolean };
function periodsFor(range: string, buckets: Bucket[]): Period[] {
  if (range === "all") {
    const years = [...new Set(buckets.map((b) => b.month.slice(0, 4)))].sort();
    if (!years.length) return [];
    return Array.from({ length: Number(years[years.length - 1]) - Number(years[0]) + 1 }, (_, n) => String(Number(years[0]) + n)).map((y) => ({ label: y, long: y, has: (m) => m.startsWith(y) }));
  }
  const now = new Date();
  return Array.from({ length: 12 }, (_, n) => {
    const at = range === "12m" ? new Date(now.getFullYear(), now.getMonth() - 11 + n, 1) : new Date(Number(range), n, 1);
    const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`;
    return { label: MONTHS[at.getMonth()], long: `${MONTHS[at.getMonth()]} ${at.getFullYear()}`, has: (m: string) => m === key };
  });
}
const add = (buckets: Bucket[], sport: string, has: (month: string) => boolean) =>
  buckets.reduce((t, b) => ((!sport || b.sport === sport) && has(b.month) ? { count: t.count + b.count, distance: t.distance + b.distance, moving: t.moving + b.moving, climb: t.climb + b.climb } : t), { count: 0, distance: 0, moving: 0, climb: 0 });
const plural = (n: number, _one: string) => `${n.toLocaleString("en-GB")} ${n === 1 ? "activity" : "activities"}`;

// The newest activities, with a button that brings in the ones before them without leaving the page.
function Latest({ first }: { first: Activity[] }) {
  const [extra, setExtra] = useState<Activity[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = [...first, ...extra.filter((a) => !first.some((f) => f.id === a.id))];
  const more = () => {
    setBusy(true);
    fetch(`/api/sport/activities?offset=${extra.length}`)
      .then((r) => r.json())
      .then((r: { total: number; items: Activity[] }) => (setTotal(r.total), setExtra((was) => [...was, ...r.items])))
      .catch(() => {})
      .finally(() => setBusy(false));
  };
  return (
    <>
      <div className="sp-rows">
        {shown.map((a) => (
          <ActivityRow key={a.id} a={a} />
        ))}
      </div>
      {first.length > 0 && (total === null || shown.length < total) && (
        <button type="button" className="btn btn-glass glass small sp-more" disabled={busy} onClick={more}>
          {busy ? "Loading…" : total === null ? "Show more" : `Show more (${(total - shown.length).toLocaleString("en-GB")} to go)`}
        </button>
      )}
    </>
  );
}

// What sits on /sport under the heading.
export function SportHome() {
  const { pbs, goals, posts } = useContent();
  const { summary, failed } = useSummary();
  const u = useUnits();
  const [sport, setSport] = useState("");
  const [range, setRange] = useState("12m");
  const [measure, setMeasure] = useState("auto");
  const buckets = useMemo(() => summary?.buckets ?? [], [summary]);

  const sports = useMemo(() => {
    const count = new Map<string, number>();
    for (const b of buckets) count.set(b.sport, (count.get(b.sport) ?? 0) + b.count);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [buckets]);
  const years = useMemo(() => [...new Set(buckets.map((b) => b.month.slice(0, 4)))].sort().reverse(), [buckets]);
  const periods = useMemo(() => periodsFor(range, buckets), [range, buckets]);
  const inRange = (m: string) => periods.some((p) => p.has(m));
  const all = add(buckets, sport, inRange);
  const far = all.distance >= 1000;
  const what = measure === "auto" || (measure === "distance" && !far) ? (far && sport ? "distance" : "time") : measure;
  const kind = sport ? kindOf(sport, far ? 1000 : 0) : "time";

  const bars: Point[] = periods.map((p) => {
    const t = add(buckets, sport, p.has);
    const value = what === "distance" ? t.distance / (u === "mi" ? 1609.344 : 1000) : what === "time" ? t.moving / 3600 : t.count;
    return { label: p.label, long: p.long, value, say: `${what === "distance" ? dist(t.distance, u) : what === "time" ? hours(t.moving) : plural(t.count, "activity")}${what === "count" ? "" : `, ${plural(t.count, "activity")}`}` };
  });
  const paces: Point[] = periods.map((p) => {
    const t = add(buckets, sport, p.has);
    const ok = t.distance >= 1000 && t.moving > 0;
    // Pace is seconds for a kilometre or mile (or 100 m in water); speed is distance in an hour.
    const value = !ok ? null : kind === "wheel" ? (t.distance / t.moving) * (u === "mi" ? 3600 / 1609.344 : 3.6) : (t.moving / t.distance) * (kind === "swim" ? (u === "mi" ? 91.44 : 100) : u === "mi" ? 1609.344 : 1000);
    return { label: p.label, long: p.long, value, say: ok ? rate(sport, t.distance, t.moving, u) : "" };
  });
  // For a sport with no distance (padel, the gym), and for all sports together: how long a session lasts.
  const lengths: Point[] = periods.map((p) => {
    const t = add(buckets, sport, p.has);
    return { label: p.label, long: p.long, value: t.count ? t.moving / t.count / 60 : null, say: t.count ? `${hours(t.moving / t.count)} a session, over ${plural(t.count, "activity")}` : "" };
  });
  const thisYear = String(new Date().getFullYear());
  const writing = posts.filter((p) => p.tags.some((t) => /sport|run|padel|tennis|fitness|race|cycling|training/i.test(t)));
  const name = sport ? sportName(sport) : "All sports";
  const when = range === "12m" ? "the last 12 months" : range === "all" ? "all time" : range;

  // Before anything has been recorded there are no numbers to draw: say so once, plainly.
  const nothing = !!summary && !summary.latest.length;

  return (
    <>
      {nothing && (
        <section className="wrap section">
          <Empty title="Nothing recorded yet">Runs, padel and gym sessions show here as they arrive from Strava, with the numbers they add up to.</Empty>
        </section>
      )}
      <section className="wrap section" hidden={nothing}>
        <div className="section-head">
          <h2>The numbers</h2>
          <span className="mono">{summary ? "Straight from Strava" : failed ? "Could not load just now" : "Loading…"}</span>
        </div>
        <div className="sp-panel glass">
          <div className="sp-filters">
            <div className="sp-chips" role="group" aria-label="Sport">
              <Pill />
              {["", ...sports].map((s) => (
                <button key={s} type="button" className="sp-chip" aria-pressed={sport === s} onClick={() => setSport(s)}>
                  {s ? sportName(s) : "All sports"}
                </button>
              ))}
            </div>
            <div className="sp-filter-row">
              <Pick label="When" value={range} onChange={setRange} options={[["12m", "Last 12 months"], ...years.map((y) => [y, y] as const), ["all", "All time"]]} />
              {far && <UnitToggle />}
            </div>
          </div>
          <div className="sp-tiles">
            <div className="sp-tile">
              <b><Num value={all.count} say={(v) => Math.round(v).toLocaleString("en-GB")} /></b>
              <span className="mono">Activities</span>
            </div>
            {far && (
              <div className="sp-tile">
                <b><Num value={all.distance / (u === "mi" ? 1609.344 : 1000)} say={(v) => `${Math.round(v).toLocaleString("en-GB")} ${u}`} /></b>
                <span className="mono">Distance</span>
              </div>
            )}
            <div className="sp-tile">
              <b><Num value={all.moving} say={hours} /></b>
              <span className="mono">Moving time</span>
            </div>
            {all.climb >= 100 && (
              <div className="sp-tile">
                <b><Num value={all.climb * (u === "mi" ? 3.28084 : 1)} say={(v) => `${Math.round(v).toLocaleString("en-GB")} ${u === "mi" ? "ft" : "m"}`} /></b>
                <span className="mono">Climbed</span>
              </div>
            )}
          </div>
          <div className="sp-charts">
            <div className="sp-chart-box">
              <Choice label="Measure" value={what} options={[...(far ? ([["distance", "Distance"]] as const) : []), ["time", "Time"], ["count", "Count"]]} onChange={setMeasure} />
              <Bars points={bars} name={`${name}, ${what === "distance" ? `distance in ${u === "mi" ? "miles" : "kilometres"}` : what === "time" ? "hours" : "number of activities"}, ${when}`} axis={(v) => (v >= 10 ? Math.round(v).toLocaleString("en-GB") : String(Math.round(v * 10) / 10))} />
            </div>
            {sport && kind !== "time" ? (
              <div className="sp-chart-box sp-swap">
                <Line points={paces} name={`${name}, average ${rateWord(sport).toLowerCase()}, ${when}`} flip={kind !== "wheel"} axis={(v) => (kind === "wheel" ? v.toFixed(1) : clock(v))} />
                <p className="sp-small">{kind === "wheel" ? "Total distance over total moving time. Higher is faster." : "Total moving time over total distance, so long slow days count for more. Higher on the chart is faster."}</p>
              </div>
            ) : (
              <div className="sp-chart-box sp-swap" key={sport}>
                <Line points={lengths} name={`${name}, how long a session lasts, ${when}`} axis={(v) => `${Math.round(v)} min`} />
                <p className="sp-small">{sport ? "Moving time divided by the number of sessions." : "Moving time divided by the number of activities, across every sport. Pick a sport for its own pace or speed."}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <Fitness u={u} />

      {(pbs.length > 0 || !!summary?.best.length) && (
        <section className="wrap section">
          <div className="section-head">
            <h2>Personal bests</h2>
            <span className="mono">The ones I am proudest of</span>
          </div>
          <div className="sp-pbs">
            {pbs.map((pb) => {
              const inner = (
                <>
                  <span className="mono">
                    {pb.sport}
                    {pb.sample ? " · sample" : ""}
                  </span>
                  <h3>{pb.title}</h3>
                  <b>{pb.result}</b>
                  <span className="sp-pb-when">
                    {pb.date ? longDay(pb.date) : ""}
                    {pb.where ? ` · ${pb.where}` : ""}
                  </span>
                  {pb.note && <p>{pb.note}</p>}
                </>
              );
              return pb.activity ? (
                <TLink key={pb.slug} href={`/sport/activities/${pb.activity}`} className="sp-pb glass">
                  {inner}
                </TLink>
              ) : (
                <div key={pb.slug} className="sp-pb glass">
                  {inner}
                </div>
              );
            })}
          </div>
          {!!summary?.best.length && (
            <>
              <div className="section-head sub">
                <h3>Fastest in any run</h3>
                <span className="mono">Found by Strava inside longer runs, so not always a race</span>
              </div>
              <div className="sp-best">
                {summary.best.map((e) => (
                  <TLink key={e.name} href={`/sport/activities/${e.id}`} className="sp-best-row glass">
                    <b>{e.name}</b>
                    <span className="sp-best-time">{clock(e.time)}</span>
                    <span className="mono">{rate("Run", e.distance, e.time, u)}</span>
                    <span className="mono">{longDay(e.date)}</span>
                  </TLink>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {goals.length > 0 && (
        <section className="wrap section">
          <div className="section-head">
            <h2>Goals</h2>
            <span className="mono">What I am working towards</span>
          </div>
          <div className="sp-goals">
            {goals.map((g) => {
              const p = goalProgress(g, buckets, thisYear);
              const done = g.done || p.part >= 1;
              return (
                <div key={g.slug} className="sp-goal glass" data-done={done}>
                  <span className="mono">
                    {g.due ? `By ${longDay(g.due)}` : g.measure === "By hand" ? "Ongoing" : thisYear}
                    {g.sample ? " · sample" : ""}
                  </span>
                  <h3>{g.title}</h3>
                  <div className="sp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.part * 100)} aria-label={g.title}>
                    <i style={{ width: `${Math.max(2, p.part * 100)}%` }} />
                  </div>
                  <span className="sp-goal-words">{done ? `Done${p.words === "Done" ? "" : `: ${p.words}`}` : p.words}</span>
                  {g.note && <p>{g.note}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="wrap section" hidden={nothing}>
        <div className="section-head">
          <h2>Latest</h2>
          <TLink href="/sport/activities" className="mono">
            Every activity
          </TLink>
        </div>
        <Latest first={summary?.latest ?? []} />
        {summary && !summary.sample && <p className="sp-small sp-powered">Powered by Strava</p>}
      </section>

      <section className="wrap section">
        <div className="section-head">
          <h2>My own logs</h2>
          <span className="mono">What the watch records, and what I add to it</span>
        </div>
        <div className="sp-doors">
          <TLink href="/sport/log" className="mu-fun glass sp-fun">
            <span className="mu-fun-art sp-fun-art" aria-hidden="true">
              <svg viewBox="0 0 100 100">
                <path d="M18 82V56M36 82V40M54 82V50M72 82V24" />
                <path d="M12 82h76" />
              </svg>
            </span>
            <span className="mu-fun-text">
              <span className="mono">Quarter by quarter</span>
              <b>Run log</b>
              <span>Every run since the first: the kind of run, how it felt, the averages and the best times.</span>
            </span>
            <span className="door-arrow" aria-hidden="true">
              <Arrow />
            </span>
          </TLink>
          <TLink href="/sport/padel" className="mu-fun glass sp-fun">
            <span className="mu-fun-art sp-fun-art" aria-hidden="true">
              <svg viewBox="0 0 100 100">
                <ellipse cx="46" cy="38" rx="24" ry="28" />
                <path d="M46 66v22M36 30h.1M46 26h.1M56 30h.1M40 42h.1M52 42h.1M46 52h.1" />
                <circle cx="80" cy="74" r="8" />
              </svg>
            </span>
            <span className="mu-fun-text">
              <span className="mono">Match by match</span>
              <b>Padel</b>
              <span>Matches, friendlies and training, with the scores and the record.</span>
            </span>
            <span className="door-arrow" aria-hidden="true">
              <Arrow />
            </span>
          </TLink>
          <TLink href="/sport/cycling" className="mu-fun glass sp-fun">
            <span className="mu-fun-art sp-fun-art" aria-hidden="true">
              <svg viewBox="0 0 100 100">
                <circle cx="26" cy="64" r="16" />
                <circle cx="74" cy="64" r="16" />
                <path d="M26 64l16-30h24l8 30M42 34l14 30M38 34h10M62 28h8" />
              </svg>
            </span>
            <span className="mu-fun-text">
              <span className="mono">Ride by ride</span>
              <b>Cycling</b>
              <span>How far, how fast and how much climbing, month by month.</span>
            </span>
            <span className="door-arrow" aria-hidden="true">
              <Arrow />
            </span>
          </TLink>
          <TLink href="/sport/gym" className="mu-fun glass sp-fun">
            <span className="mu-fun-art sp-fun-art" aria-hidden="true">
              <svg viewBox="0 0 100 100">
                <path d="M22 50h56M22 34v32M78 34v32M12 42v16M88 42v16" />
              </svg>
            </span>
            <span className="mu-fun-text">
              <span className="mono">Machine by machine</span>
              <b>Gym</b>
              <span>The weight on each machine, visit by visit, and how far it has come.</span>
            </span>
            <span className="door-arrow" aria-hidden="true">
              <Arrow />
            </span>
          </TLink>
        </div>
      </section>

      <section className="wrap section">
        <TLink href="/sport/tools" className="mu-fun glass sp-fun">
          <span className="mu-fun-art sp-fun-art" aria-hidden="true">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="54" r="32" />
              <path d="M50 54V32M42 12h16M50 12v10M74 28l6-6" />
            </svg>
          </span>
          <span className="mu-fun-text">
            <span className="mono">Work it out</span>
            <b>Tools</b>
            <span>A pace calculator with race predictions, VO₂ max for your age, padel levels across the different scales (Lithuania's letters included), body mass index and a reaction test.</span>
          </span>
          <span className="door-arrow" aria-hidden="true">
            <Arrow />
          </span>
        </TLink>
      </section>

      {writing.length > 0 && (
        <section className="wrap section">
          <div className="section-head">
            <h2>Writing</h2>
            <TLink href="/blog" className="mono">
              All posts
            </TLink>
          </div>
          <MorePosts posts={writing} step={4} />
        </section>
      )}
    </>
  );
}

// ---- Fitness: my health numbers, for my eyes only ------------------------------------------------------------- Shown only when I am signed in;…
const RANGES = [["1d", "1D"], ["1w", "1W"], ["1m", "1M"], ["1y", "1Y"], ["all", "All"]] as const;
type Range = (typeof RANGES)[number][0];
const DAYS: Record<Range, number> = { "1d": 1, "1w": 7, "1m": 31, "1y": 366, all: Infinity };
const sayHealth = (metric: Metric, v: number, u: Units) =>
  metric === "weight" ? weight(v, u) : metric === "restingHr" || metric === "walkingHr" ? `${Math.round(v)} bpm` : METRIC_INFO[metric].digits ? v.toFixed(METRIC_INFO[metric].digits) : Math.round(v).toLocaleString("en-GB");

function Fitness({ u }: { u: Units }) {
  const { data: session } = useLive<{ signedIn: boolean }>("/api/admin/session", { every: 300 });
  const { data } = useLive<{ health: HealthSeries[] }>(session?.signedIn ? "/api/admin/health" : null, { every: 600 });
  const [range, setRange] = useState<Range>("1y");
  const health = data?.health ?? [];
  if (!session?.signedIn || !health.length) return null;
  return (
    <section className="wrap section">
      <div className="section-head">
        <h2>Fitness</h2>
        <span className="mono">Only you can see this · sent by your phone</span>
      </div>
      <div className="sp-health-top">
        <Choice label="How far back" value={range} options={[...RANGES]} onChange={(v) => setRange(v as Range)} />
      </div>
      <div className="sp-health">
        {health.map((h) => {
          const points = range === "1d" ? [] : healthPoints(h, u, range);
          // With fewer than two readings in the range there is no line to draw: the reading itself is shown.
          const few = points.filter((p) => p.value !== null).length < 2;
          return (
          <div key={h.metric} className="sp-panel glass">
            {few ? <LatestReading h={h} u={u} /> : <Line key={range} points={points} name={METRIC_INFO[h.metric].name} flip={false} axis={(v) => (h.metric === "weight" && u === "mi" ? (v * 2.20462).toFixed(0) : v >= 10000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(METRIC_INFO[h.metric].digits))} />}
          </div>
          );
        })}
      </div>
    </section>
  );
}

// One day: the latest reading, and how it compares with the one before.
function LatestReading({ h, u }: { h: HealthSeries; u: Units }) {
  const last = h.points[h.points.length - 1], before = h.points[h.points.length - 2];
  const change = before ? last.value - before.value : 0;
  const digits = METRIC_INFO[h.metric].digits;
  return (
    <div className="sp-latest">
      <span className="mono">{METRIC_INFO[h.metric].name}</span>
      <b>{sayHealth(h.metric, last.value, u)}</b>
      <small>
        {longDay(last.day)}
        {before && Math.abs(change) >= 10 ** -digits / 2 ? ` · ${change > 0 ? "up" : "down"} ${Math.abs(change).toFixed(digits)} on ${longDay(before.day)}` : before ? ` · the same as ${longDay(before.day)}` : ""}
      </small>
    </div>
  );
}

function healthPoints(h: HealthSeries, u: Units, range: Range): Point[] {
  if (!h.points.length) return [];
  // The range counts back from the latest reading, so a measure that stopped arriving still shows its last stretch.
  const end = new Date(h.points[h.points.length - 1].day + "T00:00:00Z").getTime();
  const from = end - (DAYS[range] - 1) * 86400000;
  const kept = h.points.filter((p) => new Date(p.day + "T00:00:00Z").getTime() >= from);
  const point = (day: string, long: string, v: number | null, label: string): Point => ({ label, long, value: v, say: v === null ? "" : sayHealth(h.metric, v, u) });
  // A week or a month: a point for every day there is one.
  if (range === "1w" || range === "1m") return kept.map((p) => point(p.day, longDay(p.day), p.value, `${Number(p.day.slice(8))} ${MONTHS[Number(p.day.slice(5, 7)) - 1]}`));
  // Longer: one point a week (a month, over more than three years), the average of its readings.
  const span = range === "all" && kept.length && end - new Date(kept[0].day + "T00:00:00Z").getTime() > 3 * 366 * 86400000 ? 30.44 : 7;
  const slots = new Map<number, { sum: number; n: number; day: string }>();
  for (const p of kept) {
    const w = Math.floor(new Date(p.day + "T00:00:00Z").getTime() / (span * 86400000));
    const was = slots.get(w) ?? { sum: 0, n: 0, day: p.day };
    slots.set(w, { sum: was.sum + p.value, n: was.n + 1, day: was.day });
  }
  const list = [...slots.entries()].sort((a, b) => a[0] - b[0]);
  if (!list.length) return [];
  const out: Point[] = [];
  for (let w = list[0][0]; w <= list[list.length - 1][0]; w++) {
    const got = slots.get(w);
    const day = got?.day ?? new Date(w * span * 86400000).toISOString().slice(0, 10);
    out.push(point(day, span === 7 ? `Week of ${longDay(day)}` : `${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`, got ? got.sum / got.n : null, `${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(2, 4)}`));
  }
  return out;
}

// /sport/activities: everything, with filters.
export function ActivitiesView() {
  const { summary } = useSummary();
  const [sport, setSport] = useState("");
  const [year, setYear] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Activity[]>([]);
  const [found, setFound] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const buckets = summary?.buckets ?? [];
  const sports = [...new Set(buckets.map((b) => b.sport))].sort((a, b) => sportName(a).localeCompare(sportName(b)));
  const years = [...new Set(buckets.map((b) => b.month.slice(0, 4)))].sort().reverse();

  const load = (offset: number, live: () => boolean) => {
    setBusy(true);
    fetch(`/api/sport/activities?${new URLSearchParams({ sport, year, q, offset: String(offset) })}`)
      .then((r) => r.json())
      .then((r: { total: number; items: Activity[] }) => {
        if (!live()) return;
        setFound(r.total);
        setItems((was) => (offset ? [...was, ...r.items] : r.items));
      })
      .catch(() => live() && setFound((f) => f ?? 0))
      .finally(() => live() && setBusy(false));
  };
  useEffect(() => {
    let on = true;
    const wait = window.setTimeout(() => load(0, () => on), q ? 250 : 0);
    return () => {
      on = false;
      window.clearTimeout(wait);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, year, q]);

  return (
    <main className="page" data-kind="sport">
      <section className="wrap d-hero mu-fun-hero">
        <div className="d-copy">
          <p className="mono rise">
            <TLink href="/">Home</TLink> / <TLink href="/sport">Sport and fitness</TLink> / Activities
          </p>
          <h1 className="rise" style={d(80)}>
            <span className="name">Every activity</span>
          </h1>
          <p className="lede rise" style={d(160)}>
            Each run, ride, match and session, as it arrives from Strava. Open one for its route, its splits and what I wrote about it.
          </p>
        </div>
      </section>
      <section className="wrap section">
        <div className="sp-list-tools">
          <label className="bk-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.500-3.500" />
            </svg>
            <input type="search" placeholder="Search by name, sport or date" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search activities" />
          </label>
          <Pick label="Sport" value={sport} onChange={setSport} options={[["", "All sports"], ...sports.map((x) => [x, sportName(x)] as const)]} />
          <Pick label="Year" value={year} onChange={setYear} options={[["", "Every year"], ...years.map((y) => [y, y] as const)]} />
          {items.some((x) => x.distance >= 50) && <UnitToggle />}
        </div>
        <p className="mono sp-found" aria-live="polite">
          {found === null ? "Loading…" : `${found.toLocaleString("en-GB")} ${found === 1 ? "activity" : "activities"}`}
        </p>
        <div className="sp-rows">
          {items.map((a) => (
            <ActivityRow key={a.id} a={a} />
          ))}
        </div>
        {found !== null && items.length < found && (
          <button type="button" className="btn btn-glass glass small sp-more" disabled={busy} onClick={() => load(items.length, () => true)}>
            {busy ? "Loading…" : `Show more (${(found - items.length).toLocaleString("en-GB")} to go)`}
          </button>
        )}
        {summary && !summary.sample && <p className="sp-small sp-powered">Powered by Strava</p>}
      </section>
      <Footer />
    </main>
  );
}

// What I added to an activity myself: the kind of run, the padel score, the weights, a note, pictures.
function Mine({ a }: { a: ActivityDetail }) {
  const { lifts } = useContent();
  const log = a.log;
  const kind = log?.kind ?? "other";
  const day = a.start.slice(0, 10);
  const lifted = kind === "gym" ? lifts.map((l) => ({ l, e: l.log.find((x) => x.date === day) })).filter((x) => x.e) : [];
  const result = padelResult(log?.padel?.sets);
  const any = log && (log.type || log.feel || log.note || log.efforts || log.ride?.kind || log.ride?.bike || log.ride?.with || log.padel?.kind || result || log.padel?.partner || log.extras?.length);
  if (!any && !lifted.length && !log?.media?.length) return null;
  return (
    <>
      {(any || lifted.length > 0) && (
        <div className="rl-mine glass">
          <span className="mono">{kind === "gym" ? "What I lifted" : kind === "padel" ? "On court" : "From my log"}</span>
          {kind === "padel" && result && (
            <p className="pdl-big" data-outcome={result}>
              <b>{scoreOf(log?.padel?.sets)}</b>
              <span>{result === "won" ? "Won" : result === "lost" ? "Lost" : "Level"}</span>
            </p>
          )}
          <p className="rl-mine-tags">
            {kind === "run" && log?.type && typeName(log.type) && (
              <span className="post-tag">
                <i className="rl-type" data-type={log.type}>
                  {log.type}
                </i>
                {typeName(log.type)}
              </span>
            )}
            {kind === "ride" && log?.ride?.kind && <span className="post-tag">{log.ride.kind}</span>}
            {kind === "ride" && log?.ride?.bike && <span className="post-tag">{log.ride.bike}</span>}
            {kind === "ride" && log?.ride?.with && <span className="post-tag">With {log.ride.with}</span>}
            {kind === "padel" && log?.padel?.kind && <span className="post-tag">{log.padel.kind}</span>}
            {kind === "padel" && log?.padel?.partner && <span className="post-tag">With {log.padel.partner}</span>}
            {kind === "padel" && log?.padel?.opponents && <span className="post-tag">Against {log.padel.opponents}</span>}
            {kind === "padel" && log?.padel?.side && <span className="post-tag">{log.padel.side} side</span>}
            {log?.feel ? <span className="post-tag">Felt {FEELS[log.feel - 1].toLowerCase()}</span> : null}
            {kind === "run" && log?.efforts && <span className="post-tag">{log.efforts}</span>}
            {(log?.extras ?? []).map((x) => (
              <span key={x.label} className="post-tag">
                {x.label}: {x.value}
              </span>
            ))}
          </p>
          {lifted.length > 0 && (
            <ul className="gy-lifted">
              {lifted.map(({ l, e }) => (
                <li key={l.slug}>
                  <span>{l.title}</span>
                  <b>{sayLift(l, e!.value)}</b>
                </li>
              ))}
            </ul>
          )}
          {log?.note && <p>{log.note}</p>}
          <TLink href={kind === "gym" ? "/sport/gym" : kind === "padel" ? "/sport/padel" : "/sport/log"} className="mono">
            {kind === "gym" ? "The gym log" : kind === "padel" ? "All the padel" : "The whole run log"}
          </TLink>
        </div>
      )}
      {!!log?.media?.length && (
        <div className="tr-gallery" data-n={Math.min(3, log.media.length)}>
          {log.media.map((m, n) => (
            <figure key={n}>
              {/\.(mp4|webm|mov)$/i.test(m.src) || m.src.startsWith("data:video") ? (
                <video src={m.src} controls playsInline preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <Pic src={m.src} alt={m.caption ?? ""} upTo={720} sizes="(max-width: 760px) 100vw, 720px" />
              )}
              {m.caption && <figcaption>{m.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </>
  );
}

// /sport/activities/<id>: one activity.
export function ActivityView({ activity: a }: { activity: ActivityDetail }) {
  const u = useUnits();
  const { trim, tiles } = useSite().sport;
  const pace = rate(a.sport, a.distance, a.moving, u);
  const far = a.distance >= 50;
  const facts: [string, string][] = [];
  if (far) facts.push(["Distance", dist(a.distance, u)]);
  facts.push(["Moving time", far ? clock(a.moving) : hours(a.moving)]);
  if (pace) facts.push([rateWord(a.sport), pace]);
  if (a.climb >= 5) facts.push(["Climbed", height(a.climb, u)]);
  if (a.hr) facts.push(["Average heart rate", `${Math.round(a.hr)} bpm`]);
  if (a.maxHr) facts.push(["Highest heart rate", `${Math.round(a.maxHr)} bpm`]);
  if (a.calories) facts.push(["Energy", `${Math.round(a.calories).toLocaleString("en-GB")} kcal`]);
  if (a.elapsed > a.moving * 1.05) facts.push(["Start to finish", clock(a.elapsed)]);
  if (a.log?.cadence) facts.push(["Cadence", `${a.log.cadence} spm`]);
  const splits = a.splits ?? [];
  const full = splits.filter((s) => s.distance > 900);
  const fastest = Math.min(...full.map((s) => s.time / s.distance)), slowest = Math.max(...full.map((s) => s.time / s.distance));
  return (
    <main className="page" data-kind="sport">
      <article className="wrap work sp-page">
        <p className="mono rise">
          <TLink href="/">Home</TLink> / <TLink href="/sport">Sport</TLink> / <TLink href="/sport/activities">Activities</TLink>
        </p>
        <h1 className="rise" style={d(80)}>
          <span className="name">{a.name || sportName(a.sport)}</span>
        </h1>
        <div className="sp-meta rise" style={d(140)}>
          <span className="post-tag">{sportName(a.sport)}</span>
          {a.sample && <span className="post-tag sample">sample activity</span>}
          <span className="mono">
            {dayOf(a.start)}
            {a.id.startsWith("-") ? "" : ` · ${timeOf(a.start)}`}
          </span>
          {far && <UnitToggle />}
        </div>
        <div className="sp-facts rise" style={d(200)}>
          {facts.map(([k, v]) => (
            <div key={k} className="sp-tile glass">
              <b key={v} className="sp-swap">{v}</b>
              <span className="mono">{k}</span>
            </div>
          ))}
        </div>
        <Mine a={a} />
        {a.description && <p className="lede sp-words">{a.description}</p>}
        {a.route && a.route.length > 1 && (
          <figure className="sp-map-box glass">
            <RouteMap route={a.route} tiles={tiles} />
            <figcaption className="sp-small">
              The route, start to finish (the ringed dot).{!a.sample && trim > 0 ? ` The first and last ${trim} m are left off.` : ""}
            </figcaption>
          </figure>
        )}
        {full.length > 1 && (
          <section>
            <div className="section-head sub">
              <h2>Kilometre by kilometre</h2>
              <span className="mono">A longer bar is a faster kilometre</span>
            </div>
            <div className="sp-splits glass">
              {splits.map((s) => {
                const per = s.time / s.distance;
                const part = s.distance > 900 ? 0.35 + 0.65 * (slowest === fastest ? 1 : (slowest - per) / (slowest - fastest)) : 0;
                return (
                  <div key={s.n} className="sp-split" data-best={per === fastest}>
                    <span className="mono">{s.distance > 900 ? s.n : `${(s.distance / 1000).toFixed(1)} km`}</span>
                    <div>{part > 0 && <i style={{ width: `${part * 100}%` }} />}</div>
                    <b key={u} className="sp-swap">{rate(a.sport, s.distance, s.time, u)}</b>
                    <em>{s.hr ? `${Math.round(s.hr)} bpm` : ""}</em>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {!!a.efforts?.length && (
          <section>
            <div className="section-head sub">
              <h2>Fastest stretches</h2>
              <span className="mono">The quickest of each distance inside this one</span>
            </div>
            <div className="sp-best">
              {a.efforts.map((e) => (
                <div key={e.name} className="sp-best-row glass">
                  <b>{e.name}</b>
                  <span className="sp-best-time">{clock(e.time)}</span>
                  <span className="mono">{rate(a.sport, e.distance, e.time, u)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        <p className="sp-out">
          {!a.sample && (
            <a className="btn btn-glass glass small" href={`https://www.strava.com/activities/${a.id}`} target="_blank" rel="noreferrer">
              View on Strava
            </a>
          )}
          <TLink href="/sport/activities" className="btn btn-ghost small">
            Every activity
          </TLink>
        </p>
      </article>
      <Footer />
    </main>
  );
}

// /sport/tools
export function SportToolsView() {
  return (
    <main className="page" data-kind="sport">
      <section className="wrap d-hero mu-fun-hero">
        <div className="d-copy">
          <p className="mono rise">
            <TLink href="/">Home</TLink> / <TLink href="/sport">Sport and fitness</TLink> / Tools
          </p>
          <h1 className="rise" style={d(80)}>
            <span className="name">Tools</span>
          </h1>
          <p className="lede rise" style={d(160)}>
            The sums I kept doing in my head, done properly. Everything works in your browser; nothing you type is sent anywhere.
          </p>
        </div>
      </section>
      <section className="wrap section">
        <div className="lab-grid sims">
          <Pace />
          <Vo2Max />
          <PadelLevels />
          <Bmi />
          <Reaction />
        </div>
      </section>
      <Footer />
    </main>
  );
}
