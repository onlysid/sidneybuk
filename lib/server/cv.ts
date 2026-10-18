import "server-only";
import { query, hasDatabase } from "./db";
import { seedCv, upgradeCv, type Cv } from "@/lib/cv";

// The CV lives in the settings table under "cv", with the time it was last saved.
const memo = globalThis as unknown as { __cv?: { value: Cv; at: number } };

export async function getCv(): Promise<Cv> {
  if (!hasDatabase()) return seedCv;
  if (memo.__cv && Date.now() - memo.__cv.at < 15000) return memo.__cv.value;
  try {
    const rows = await query<{ value: unknown }>("select value from settings where key = 'cv'");
    const value = rows[0] ? upgradeCv(rows[0].value) : seedCv;
    memo.__cv = { value, at: Date.now() };
    return value;
  } catch {
    return memo.__cv?.value ?? seedCv;
  }
}

export async function saveCv(input: unknown) {
  const cv = upgradeCv(input);
  const trim = (s: string, n: number) => s.replace(/\r\n/g, "\n").trim().slice(0, n);
  const clean: Cv = {
    headline: trim(cv.headline, 120),
    phone: trim(cv.phone, 40),
    linkedin: trim(cv.linkedin, 200),
    summary: trim(cv.summary, 2000),
    skills: cv.skills.slice(0, 8).map((g) => ({ label: trim(g.label, 60), items: g.items.slice(0, 40).map((x) => trim(x, 60)).filter(Boolean) })).filter((g) => g.items.length || g.label),
    jobs: cv.jobs.slice(0, 20).map((j) => ({
      role: trim(j.role, 120),
      org: trim(j.org, 120),
      when: trim(j.when, 60),
      bullets: j.bullets.slice(0, 30).map((b) => trim(b, 1000)).filter(Boolean),
      projects: j.projects.slice(0, 12).map((p) => ({ name: trim(p.name, 120), role: trim(p.role, 80), bullets: p.bullets.slice(0, 30).map((b) => trim(b, 1000)).filter(Boolean) })),
    })),
    education: cv.education.slice(0, 20).map((l) => trim(l, 400)).filter(Boolean),
    interests: cv.interests.slice(0, 40).map((x) => trim(x, 60)).filter(Boolean),
    updatedAt: new Date().toISOString(),
  };
  await query("insert into settings (key, value) values ('cv', $1) on conflict (key) do update set value = excluded.value", [JSON.stringify(clean)]);
  memo.__cv = { value: clean, at: Date.now() };
  return clean;
}
