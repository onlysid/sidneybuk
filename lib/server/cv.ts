import "server-only";
import { query, hasDatabase } from "./db";
import { seedCv, type Cv } from "@/lib/cv";

// The CV lives in the settings table under "cv", with the time it was last saved.
const memo = globalThis as unknown as { __cv?: { value: Cv; at: number } };

export async function getCv(): Promise<Cv> {
  if (!hasDatabase()) return seedCv;
  if (memo.__cv && Date.now() - memo.__cv.at < 15000) return memo.__cv.value;
  try {
    const rows = await query<{ value: Partial<Cv> }>("select value from settings where key = 'cv'");
    const value = { ...seedCv, ...(rows[0]?.value ?? {}) };
    memo.__cv = { value, at: Date.now() };
    return value;
  } catch {
    return memo.__cv?.value ?? seedCv;
  }
}

export async function saveCv(input: Partial<Cv>) {
  const clean = (s: unknown) => String(s ?? "").replace(/\r\n/g, "\n");
  const cv: Cv = {
    phone: clean(input.phone).slice(0, 40),
    linkedin: clean(input.linkedin).slice(0, 200),
    summary: clean(input.summary).slice(0, 2000),
    skills: clean(input.skills).slice(0, 2000),
    jobs: (Array.isArray(input.jobs) ? input.jobs : []).slice(0, 20).map((j) => ({ role: clean(j?.role).slice(0, 120), org: clean(j?.org).slice(0, 120), when: clean(j?.when).slice(0, 60), bullets: clean(j?.bullets).slice(0, 12000) })),
    education: clean(input.education).slice(0, 3000),
    interests: clean(input.interests).slice(0, 1000),
    updatedAt: new Date().toISOString(),
  };
  await query("insert into settings (key, value) values ('cv', $1) on conflict (key) do update set value = excluded.value", [JSON.stringify(cv)]);
  memo.__cv = { value: cv, at: Date.now() };
  return cv;
}
