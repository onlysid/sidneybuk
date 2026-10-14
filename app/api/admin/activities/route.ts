import { guard } from "@/lib/server/auth";
import { addActivity, adminActivities, adminActivity, importRunLog, removeActivity, runLogState, saveLog, setHidden } from "@/lib/server/sport";

export const dynamic = "force-dynamic";
const isId = (id: unknown) => /^-?\d{1,19}$/.test(String(id));

// Every activity, hidden ones included, with what has been written on each. ?id= gives one; ?kind= narrows
// the list to runs, gym sessions or padel.
export async function GET(request: Request) {
  const stop = await guard(request);
  if (stop) return stop;
  const p = new URL(request.url).searchParams;
  if (p.get("runlog")) return Response.json(await runLogState());
  if (p.get("id")) {
    const one = isId(p.get("id")) ? await adminActivity(p.get("id")!) : undefined;
    return one ? Response.json({ activity: one }) : Response.json({ error: "That activity is not there." }, { status: 404 });
  }
  return Response.json(await adminActivities((p.get("q") ?? "").slice(0, 80), Math.max(0, Number(p.get("offset")) || 0), p.get("kind") ?? ""));
}
// Hide one from the site or show it again ({ id, hidden }), or save what I wrote on it ({ id, log }).
export async function PUT(request: Request) {
  const stop = await guard(request);
  if (stop) return stop;
  const { id, hidden, log } = (await request.json().catch(() => ({}))) as { id?: string; hidden?: boolean; log?: Record<string, unknown> };
  if (!isId(id)) return Response.json({ error: "Which activity?" }, { status: 400 });
  if (typeof hidden === "boolean") await setHidden(String(id), hidden);
  if (log && typeof log === "object" && !(await saveLog(String(id), log))) return Response.json({ error: "That activity is not there any more." }, { status: 404 });
  return Response.json({ ok: true });
}
// Something Strava never saw, typed in by hand: { date, sport, name, time, km, hr }
export async function POST(request: Request) {
  const stop = await guard(request);
  if (stop) return stop;
  try {
    const body = (await request.clone().json().catch(() => ({}))) as { import?: string };
    // { import: "runlog" } brings in the old spreadsheet of runs.
    if (body.import === "runlog") return Response.json(await importRunLog());
    return Response.json({ id: await addActivity((await request.json().catch(() => ({}))) as Record<string, unknown>) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
// Removes something that was typed in by hand.
export async function DELETE(request: Request) {
  const stop = await guard(request);
  if (stop) return stop;
  try {
    await removeActivity(new URL(request.url).searchParams.get("id") ?? "");
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
