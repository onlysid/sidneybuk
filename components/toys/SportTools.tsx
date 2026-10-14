"use client";

import { useState } from "react";
import { Choice } from "@/components/Sport";

// ---- Body mass index ------------------------------------------------------------------------------------------
const BANDS: [number, string][] = [[18.5, "Underweight"], [25, "Healthy weight"], [30, "Overweight"], [99, "Obese"]];
export function Bmi() {
  const [u, setU] = useState<string>("km");
  const [cm, setCm] = useState(178);
  const [kg, setKg] = useState(72);
  const bmi = kg / (cm / 100) ** 2;
  const ok = Number.isFinite(bmi) && bmi > 5 && bmi < 80;
  const band = BANDS.find(([top]) => bmi < top)?.[1] ?? "";
  const num = (set: (n: number) => void, k = 1) => (e: React.ChangeEvent<HTMLInputElement>) => set((Number(e.target.value) || 0) * k);
  const feet = Math.floor(cm / 2.54 / 12), inches = Math.round(cm / 2.54 - feet * 12);
  return (
    <div className="lab-card">
      <h3>Body mass index</h3>
      <p>Weight divided by height squared. A blunt number: it cannot tell muscle from fat, so it reads high for a lot of athletes.</p>
      <Choice label="Units" value={u} options={[["km", "cm and kg"], ["mi", "ft and lb"]]} onChange={setU} />
      <div className="pace-row">
        {u === "km" ? (
          <label className="pace-field">
            <span className="mono">Height, cm</span>
            <input type="number" inputMode="decimal" min={100} max={230} value={Math.round(cm)} onChange={num(setCm)} />
          </label>
        ) : (
          <>
            <label className="pace-field">
              <span className="mono">Feet</span>
              <input type="number" inputMode="numeric" min={3} max={7} value={feet} onChange={(e) => setCm(((Number(e.target.value) || 0) * 12 + inches) * 2.54)} />
            </label>
            <label className="pace-field">
              <span className="mono">Inches</span>
              <input type="number" inputMode="numeric" min={0} max={11} value={inches} onChange={(e) => setCm((feet * 12 + (Number(e.target.value) || 0)) * 2.54)} />
            </label>
          </>
        )}
        <label className="pace-field">
          <span className="mono">Weight, {u === "km" ? "kg" : "lb"}</span>
          <input type="number" inputMode="decimal" min={30} max={600} value={u === "km" ? Math.round(kg * 10) / 10 : Math.round(kg * 2.20462)} onChange={num(setKg, u === "km" ? 1 : 1 / 2.20462)} />
        </label>
      </div>
      <div className="pace-out sp-bmi-out">
        <div>
          <b>{ok ? bmi.toFixed(1) : "–"}</b>
          <span className="mono">BMI</span>
        </div>
        <div>
          <b className="sp-plain">{ok ? band : "–"}</b>
          <span className="mono">By the usual bands</span>
        </div>
      </div>
      <div className="sp-scale" aria-hidden="true">
        <i style={{ left: `${Math.max(0, Math.min(100, ((bmi - 15) / 20) * 100))}%` }} />
        {[18.5, 25, 30].map((v) => (
          <span key={v} style={{ left: `${((v - 15) / 20) * 100}%` }}>
            {v}
          </span>
        ))}
      </div>
      <p className="sp-small">Nothing you type here is kept or sent anywhere.</p>
    </div>
  );
}

// ---- Padel levels ------------------------------------------------------------------------------------------------ A rough guide for lining up the…
const PADEL: [number, string, string, string][] = [
  [1, "Starting out", "Iniciación", "Learning the rules, the grip and how to keep a rally going."],
  [2, "Beginner", "5ª", "Rallies at a gentle pace. The back wall is still a surprise."],
  [3, "Improver", "4ª", "Uses the back wall, has a serve and a volley, starting to lob on purpose."],
  [4, "Intermediate", "3ª", "Controls direction and height, holds the net, has a bandeja of sorts."],
  [5, "Advanced", "2ª", "Varies pace and spin, defends off both walls, wins points with a plan."],
  [6, "Expert", "1ª", "Competes in regional tournaments. Few weaknesses to aim at."],
  [7.01, "Professional", "1ª and the pro tours", "National and international competition."],
];
// The letters used in Lithuania, from D for someone new up to A+.
const LT: [string, number, string][] = [
  ["D", 1, "Naujokas"],
  ["D+", 1.5, "Naujokas"],
  ["C-", 2, "Pradedantysis"],
  ["C", 2.5, "Pradedantysis"],
  ["C+", 3, "Pradedantysis"],
  ["B-", 3.5, "Vidutinis"],
  ["B", 4, "Vidutinis"],
  ["B+", 4.5, "Vidutinis"],
  ["A-", 5, "Pažengęs"],
  ["A", 5.5, "Pažengęs"],
  ["A+", 6, "Profesionalas"],
];
const ltAt = (level: number) => Math.max(0, LT.findLastIndex(([, from]) => level >= from));
const SCALES = [["playtomic", "Playtomic, 0 to 7"], ["lt", "Lithuanian, D to A"], ["ten", "1 to 10"]] as const;
export function PadelLevels() {
  const [scale, setScale] = useState<string>("lt");
  const [level, setLevel] = useState(3.5); // always held as a level on the 0 to 7 scale
  const ten = 1 + (level * 9) / 7;
  const band = PADEL.find(([top]) => level < top) ?? PADEL[PADEL.length - 1];
  const lt = LT[ltAt(level)];
  const slider =
    scale === "lt"
      ? { min: 0, max: LT.length - 1, step: 1, value: ltAt(level), set: (v: number) => setLevel(LT[v][1]), shown: lt[0] }
      : scale === "playtomic"
        ? { min: 0, max: 7, step: 0.1, value: level, set: setLevel, shown: level.toFixed(1) }
        : { min: 1, max: 10, step: 0.1, value: ten, set: (v: number) => setLevel(((v - 1) * 7) / 9), shown: ten.toFixed(1) };
  return (
    <div className="lab-card">
      <h3>Padel levels</h3>
      <p>Put in a level on one scale and see roughly where it sits on the others. A guide, not a ruling: every club grades a little differently.</p>
      <Choice label="Scale" value={scale} options={SCALES as unknown as [string, string][]} onChange={setScale} />
      <label className="sp-slider">
        <span className="mono">
          Level <b>{slider.shown}</b>
        </span>
        <input type="range" min={slider.min} max={slider.max} step={slider.step} value={slider.value} onChange={(e) => slider.set(Number(e.target.value))} />
      </label>
      {scale === "lt" && (
        <div className="sp-letters" aria-hidden="true">
          {LT.map(([letter], k) => (
            <span key={letter} data-on={k === ltAt(level)}>
              {letter}
            </span>
          ))}
        </div>
      )}
      <div className="pace-out sp-padel-out">
        <div>
          <b>{lt[0]}</b>
          <span className="mono">Lithuania</span>
        </div>
        <div>
          <b>{level.toFixed(1)}</b>
          <span className="mono">Playtomic</span>
        </div>
        <div>
          <b>{ten.toFixed(1)}</b>
          <span className="mono">Out of 10</span>
        </div>
        <div>
          <b>{band[2].split(" ")[0]}</b>
          <span className="mono">Spain</span>
        </div>
      </div>
      <p className="sp-level">
        <b>
          {band[1]} ({lt[2].toLowerCase()}).
        </b>{" "}
        {band[3]}
      </p>
      <p className="sp-small">Lithuania has no one official scale. The letters here are the common D to A ladder, where each letter with its minus and plus covers about a level and a half of the 1 to 7 scale.</p>
    </div>
  );
}

// ---- VO2 max for the age ------------------------------------------------------------------------------------------- How much oxygen the body can…
const VO2: Record<string, [number, number[]][]> = {
  m: [
    [20, [35.0, 38.4, 45.2, 51.0, 56.0]],
    [30, [33.0, 36.5, 42.5, 46.5, 52.5]],
    [40, [31.5, 35.5, 41.0, 45.0, 49.5]],
    [50, [30.2, 33.6, 39.0, 43.8, 48.1]],
    [60, [26.1, 31.0, 35.8, 41.0, 45.4]],
    [200, [20.5, 26.1, 32.3, 36.5, 44.3]],
  ],
  f: [
    [20, [25.0, 31.0, 35.0, 39.0, 42.0]],
    [30, [23.6, 29.0, 33.0, 37.0, 41.1]],
    [40, [22.8, 27.0, 31.5, 35.7, 40.1]],
    [50, [21.0, 24.5, 29.0, 32.9, 37.0]],
    [60, [20.2, 22.8, 27.0, 31.5, 35.8]],
    [200, [17.5, 20.2, 24.5, 30.3, 31.5]],
  ],
};
const GRADES = ["Very poor", "Poor", "Fair", "Good", "Excellent", "Superior"];
const AGES = ["13 to 19", "20 to 29", "30 to 39", "40 to 49", "50 to 59", "60 and over"];
export function Vo2Max() {
  const [sex, setSex] = useState<string>("m");
  const [age, setAge] = useState(29);
  const [vo2, setVo2] = useState(48);
  const row = Math.max(0, VO2[sex].findIndex(([under]) => age < under));
  const marks = VO2[sex][row][1];
  const grade = marks.filter((m) => vo2 >= m).length;
  const from = marks[0] - 7, to = marks[4] + 7;
  const at = (v: number) => Math.max(0, Math.min(100, ((v - from) / (to - from)) * 100));
  const ok = vo2 >= 10 && vo2 <= 95 && age >= 13 && age <= 110;
  const next = grade < 5 ? marks[grade] - vo2 : 0;
  return (
    <div className="lab-card">
      <h3>VO₂ max for your age</h3>
      <p>The most oxygen your body can use, per kilogram, per minute. A watch estimates it from pace and heart rate. What counts as good depends on age and sex.</p>
      <Choice label="Sex" value={sex} options={[["m", "Male"], ["f", "Female"]]} onChange={setSex} />
      <div className="pace-row">
        <label className="pace-field">
          <span className="mono">Age</span>
          <input type="number" inputMode="numeric" min={13} max={110} value={age || ""} onChange={(e) => setAge(Number(e.target.value) || 0)} />
        </label>
        <label className="pace-field">
          <span className="mono">VO₂ max</span>
          <input type="number" inputMode="decimal" min={10} max={95} step={0.1} value={vo2 || ""} onChange={(e) => setVo2(Number(e.target.value) || 0)} />
        </label>
      </div>
      <div className="pace-out sp-bmi-out">
        <div>
          <b>{ok ? vo2.toFixed(1) : "–"}</b>
          <span className="mono">ml/kg/min</span>
        </div>
        <div>
          <b className="sp-plain" key={grade}>
            {ok ? GRADES[grade] : "–"}
          </b>
          <span className="mono">For ages {AGES[row]}</span>
        </div>
      </div>
      <div className="sp-gauge" role="img" aria-label={ok ? `${GRADES[grade]} for ${sex === "m" ? "men" : "women"} aged ${AGES[row]}` : "Put in an age and a VO2 max"}>
        <div className="sp-gauge-bar">
          {GRADES.map((g, k) => {
            const lo = k === 0 ? from : marks[k - 1], hi = k === 5 ? to : marks[k];
            return <i key={g} data-on={ok && k === grade} style={{ left: `${at(lo)}%`, width: `${at(hi) - at(lo)}%`, opacity: 0.3 + k * 0.14 }} />;
          })}
          {ok && <b style={{ left: `${at(vo2)}%` }} />}
        </div>
        <div className="sp-gauge-marks mono">
          {marks.map((m, k) => (
            <span key={k} style={{ left: `${at(m)}%` }}>
              {m % 1 ? m.toFixed(1) : m}
            </span>
          ))}
        </div>
        <div className="sp-gauge-names mono">
          {GRADES.map((g, k) => {
            const lo = k === 0 ? from : marks[k - 1], hi = k === 5 ? to : marks[k];
            return (
              <span key={g} data-on={ok && k === grade} style={{ left: `${(at(lo) + at(hi)) / 2}%` }}>
                {g}
              </span>
            );
          })}
        </div>
      </div>
      <p className="sp-level">
        {!ok ? "Put in an age from 13 up and a VO₂ max." : grade === 5 ? <>That is in the top band for {sex === "m" ? "men" : "women"} aged {AGES[row]}.</> : <><b>{next.toFixed(1)} more</b> would reach {GRADES[grade + 1].toLowerCase()} ({marks[grade]} and over) for {sex === "m" ? "men" : "women"} aged {AGES[row]}.</>}
      </p>
      <p className="sp-small">Bands from the Cooper Institute, as printed in Heyward (1998). The source gives figures for men and women only.</p>
    </div>
  );
}
