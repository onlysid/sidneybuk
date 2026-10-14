"use client";

import { Pill } from "@/components/Pill";
import { useEffect, useMemo, useRef, useState } from "react";
import data from "@/lib/github-data.json";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Per-day counts from the profile's contribution calendar, which includes private repositories.
const days = data.contributions as Record<string, number>;
const iso = (d: Date) => d.toISOString().slice(0, 10);

// Counts up to its value the first time it scrolls into view.
function Count({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(to);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setN(0);
    let frame = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1100);
        setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to]);
  return <span ref={ref}>{n}</span>;
}

// GitHub, as activity rather than a list of repositories: everything GitHub counts as a contribution, private work included, as numbers per day.
export function GitHubPanel() {
  const stats = useMemo(() => {
    const dates = Object.keys(days).sort();
    const total = dates.reduce((a, d) => a + days[d], 0);
    const byWeekday = Array(7).fill(0) as number[];
    const byMonth = Array(12).fill(0) as number[];
    dates.forEach((d) => {
      byWeekday[(new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7] += days[d];
      byMonth[Number(d.slice(5, 7)) - 1] += days[d];
    });
    let best = 0, run = 0, prev = 0;
    dates.forEach((d) => {
      const t = Date.parse(d + "T00:00:00Z");
      run = t - prev === 86400000 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = t;
    });
    const peak = dates.reduce((a, d) => (days[d] > days[a] ? d : a), dates[0]);
    const years = [...new Set(dates.map((d) => Number(d.slice(0, 4))))];
    const perYear = Object.fromEntries(years.map((y) => [y, dates.filter((d) => d.startsWith(String(y))).reduce((a, d) => a + days[d], 0)]));
    return { total, active: dates.length, byWeekday, byMonth, best, peak, years, perYear, busiest: WEEKDAYS[byWeekday.indexOf(Math.max(...byWeekday))], last: dates[dates.length - 1] };
  }, []);

  // Open on the most recent year.
  const [year, setYear] = useState(() => Math.max(...stats.years));
  // The day under the pointer (or the last one tapped), for the label that floats above it.
  const heat = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ date: string; n: number; x: number; y: number; flip: boolean } | null>(null);
  const point = (e: React.PointerEvent) => {
    const cell = (e.target as Element).closest?.("rect.cell") as SVGRectElement | null;
    const box = heat.current?.getBoundingClientRect();
    if (!cell || !box || !cell.dataset.date) return setTip(null);
    const r = cell.getBoundingClientRect();
    const x = r.left + r.width / 2 - box.left;
    setTip({ date: cell.dataset.date, n: Number(cell.dataset.n), x: Math.max(80, Math.min(box.width - 80, x)), y: r.top - box.top, flip: r.top - box.top < 64 });
  };

  // The classic grid: one column per week, Monday at the top.
  const grid = useMemo(() => {
    const first = new Date(Date.UTC(year, 0, 1));
    const start = new Date(first);
    start.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
    const cells: { x: number; y: number; date: string; n: number; inYear: boolean }[] = [];
    const months: { x: number; label: string }[] = [];
    for (let w = 0; w < 53; w++)
      for (let d = 0; d < 7; d++) {
        const day = new Date(start);
        day.setUTCDate(start.getUTCDate() + w * 7 + d);
        const date = iso(day);
        const inYear = day.getUTCFullYear() === year;
        if (inYear && day.getUTCDate() === 1) months.push({ x: w, label: MONTHS[day.getUTCMonth()] });
        cells.push({ x: w, y: d, date, n: inYear ? (days[date] ?? 0) : 0, inYear });
      }
    return { cells, months, max: Math.max(1, ...cells.map((c) => c.n)) };
  }, [year]);

  // Square-root steps, so one huge day does not flatten every other day to the palest shade.
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil(Math.sqrt(n / grid.max) * 4)));
  const maxWeekday = Math.max(...stats.byWeekday);
  const maxMonth = Math.max(...stats.byMonth);
  const maxYear = Math.max(...Object.values(stats.perYear));
  const peakDate = new Date(stats.peak + "T00:00:00Z");
  const tiles: [React.ReactNode, React.ReactNode][] = [
    [<Count key="a" to={stats.total} />, `contributions since ${stats.years[0]}, public and private`],
    [<Count key="b" to={stats.perYear[Math.max(...stats.years)]} />, `of them so far in ${Math.max(...stats.years)}`],
    [<Count key="c" to={stats.active} />, "days with something pushed"],
    [<Count key="d" to={stats.best} />, "days in a row, best streak"],
    [stats.busiest, "is the busiest day"],
    [<Count key="e" to={days[stats.peak]} />, `on ${peakDate.getUTCDate()} ${MONTHS[peakDate.getUTCMonth()]} ${peakDate.getUTCFullYear()}, the biggest day`],
  ];

  return (
    <>
      <div className="section-head">
        <h2>On GitHub</h2>
        <span className="mono">All activity, private work included, as of {data.generatedAt}</span>
      </div>

      <div className="stats">
        {tiles.map(([big, label], n) => (
          <div key={n} className="stat glass">
            <b>{big}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="heat glass" ref={heat}>
        {tip && (
          <p className="heat-tip" style={{ left: tip.x, top: tip.y }} data-flip={tip.flip} role="status">
            <b>{tip.n === 0 ? "Nothing" : `${tip.n} contribution${tip.n === 1 ? "" : "s"}`}</b>
            <span>{new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(tip.date + "T00:00:00Z"))}</span>
          </p>
        )}
        <div className="heat-head">
          <h3>
            {stats.perYear[year]} contributions in {year}
          </h3>
          <div className="seg" role="group" aria-label="Year">
          <Pill />
            {[...stats.years].reverse().map((y) => (
              <button key={y} type="button" aria-pressed={y === year} onClick={() => setYear(y)}>
                {y}
              </button>
            ))}
          </div>
        </div>
        <div className="heat-scroll">
          <svg key={year} viewBox="0 0 660 112" className="heat-grid" role="img" aria-label={`Contributions per day in ${year}`} onPointerMove={point} onPointerDown={point} onPointerLeave={() => setTip(null)}>
            {grid.months.map((m) => (
              <text key={m.label} x={28 + m.x * 12} y="9" className="tick">
                {m.label}
              </text>
            ))}
            {[0, 2, 4, 6].map((d) => (
              <text key={d} x="0" y={24 + d * 12} className="tick">
                {WEEKDAYS[d]}
              </text>
            ))}
            {grid.cells.map(
              (c) =>
                c.inYear && (
                  <rect key={c.date} className="cell" data-level={level(c.n)} data-date={c.date} data-n={c.n} data-on={tip?.date === c.date} x={28 + c.x * 12} y={15 + c.y * 12} width="10" height="10" rx="2.5" style={{ ["--d" as string]: `${c.x * 12 + c.y * 6}ms` }} />
                ),
            )}
          </svg>
        </div>
        <div className="heat-legend mono">
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <i key={l} className="cell" data-level={l} />
          ))}
          More
        </div>
      </div>

      <div className="grid charts">
        <div className="lab-card">
          <h3>By day of the week</h3>
          <div className="spectrum">
            {stats.byWeekday.map((n, d) => (
              <div key={d} className="partial">
                <em>{n}</em>
                <i style={{ height: `${(n / maxWeekday) * 100}%` }} />
                <span>{WEEKDAYS[d]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="lab-card">
          <h3>By month, all years</h3>
          <div className="spectrum months">
            {stats.byMonth.map((n, m) => (
              <div key={m} className="partial">
                <em>{n}</em>
                <i style={{ height: `${(n / maxMonth) * 100}%` }} />
                <span>{MONTHS[m][0]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="lab-card">
          <h3>Year by year</h3>
          <div className="hbars">
            {[...stats.years].reverse().map((y) => (
              <div key={y} className="hbar" data-on={y === year}>
                <span>{y}</span>
                <div>
                  <b style={{ width: `${(stats.perYear[y] / maxYear) * 100}%` }} />
                </div>
                <em>{stats.perYear[y]}</em>
              </div>
            ))}
          </div>
        </div>
      </div>

      <a className="btn btn-glass glass more" href={`https://github.com/${data.user.login}`} target="_blank" rel="noreferrer">
        github.com/{data.user.login}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 17L17 7M9 7h8v8" />
        </svg>
      </a>
    </>
  );
}
