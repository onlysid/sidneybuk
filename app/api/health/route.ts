import { same } from "@/lib/server/secrets";
import { saveHealth } from "@/lib/server/sport";
import { getKey } from "@/lib/server/store";

export const dynamic = "force-dynamic";

// Lets my phone send health numbers. Same password as /api/location.
//
//   POST /api/health
//   Authorization: Bearer <the "LOCATION_TOKEN" set in the admin area under Connections>
//
// It takes any of these shapes:
//   { "metric": "vo2max", "date": "2026-10-08", "value": 51.2 }
//   { "metric": "vo2max", "samples": [{ "date": "2026-10-08", "value": 51.2 }, …] }
//   { "samples": [{ "metric": "restingHr", "date": "…", "value": 52 }, …] }
//   what the "Health Auto Export" app sends: { "data": { "metrics": [{ "name": "vo2_max", "data": [{ "date": "…", "qty": 51.2 }] }] } }
// Or plain text, one reading a line, with the measure in the address:
//   POST /api/health?metric=steps        2026-10-08,9312
//                                         2026-10-09,11020
// A whole history can come at once: { "metric": "steps", "samples": [ … thousands … ] }.
// One value is kept per measure per day (several readings on a day are added up or averaged, as suits the measure).
// Metrics: vo2max, restingHr, hrv, walkingHr, respiratoryRate, bloodOxygen, sleepHours, steps, exerciseMinutes,
// activeEnergy (kcal), weight (kilograms), bodyFat (%). Apple Health's own names for them are understood too.
type Sample = { metric?: string; date?: string; value?: number | string; qty?: number | string };
export async function POST(request: Request) {
  const token = await getKey("LOCATION_TOKEN");
  const sent = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || token.length < 12 || !same(sent, token)) return Response.json({ error: "Not allowed" }, { status: 401 });
  // The body is JSON, or (easier to put together in a Shortcut) plain lines of "date,value", with the measure
  // named in the address: /api/health?metric=steps. A line may also be "metric,date,value".
  const raw = await request.text();
  const named = new URL(request.url).searchParams.get("metric") ?? undefined;
  let body: { metric?: string; date?: string; value?: number | string; samples?: Sample[]; data?: { metrics?: { name?: string; data?: Sample[] }[] } } | null = null;
  try {
    body = JSON.parse(raw);
  } catch {
    const samples: Sample[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const parts = line.split(/[,;\t]/).map((x) => x.trim()).filter(Boolean);
      if (parts.length === 2) samples.push({ date: parts[0], value: parts[1] });
      else if (parts.length >= 3) samples.push({ metric: parts[0], date: parts[1], value: parts[2] });
    }
    if (samples.length) body = { metric: named, samples };
  }
  if (body && typeof body === "object" && !Array.isArray(body) && !body.metric && named) body.metric = named;
  if (!body || typeof body !== "object") return Response.json({ error: "Send JSON, or lines of date,value" }, { status: 400 });
  const out: { metric: string; date: string; value: number }[] = [];
  const add = (metric: string | undefined, s: Sample) => out.push({ metric: String(s.metric ?? metric ?? ""), date: String(s.date ?? ""), value: Number(s.value ?? s.qty) });
  if (body.date) add(body.metric, body);
  for (const s of body.samples ?? []) add(body.metric, s);
  for (const m of body.data?.metrics ?? []) for (const s of m.data ?? []) add(m.name, s);
  if (out.length > 200000) return Response.json({ error: "Too many at once; send 200,000 or fewer" }, { status: 400 });
  const saved = await saveHealth(out);
  return saved ? Response.json({ ok: true, saved }) : Response.json({ error: "Nothing in that could be used. Send a metric (for example vo2max, restingHr, steps or weight), a date and a value." }, { status: 400 });
}
