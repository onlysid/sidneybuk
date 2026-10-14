import { same } from "@/lib/server/secrets";
import { getKey, getSettings, saveSettings } from "@/lib/server/store";

export const dynamic = "force-dynamic";

// Lets my phone tell the site where I am. A Shortcut on the phone sends:
//
//   POST /api/location
//   Authorization: Bearer <the "LOCATION_TOKEN" set in the admin area under Connections>
//   { "name": "Sacramento, California", "lat": 38.58, "lon": -121.49, "timeZone": "America/Los_Angeles" }
//
// Two ways of working:
//   Automatic  The everyday Shortcut, run on a timer. Just the place, as above.
//   Manual     Sent by hand, with "manual": true and usually a "message" ("Here for a wedding"). The place and
//              message then stay put: automatic updates are ignored until I send "manual": false, or until
//              the number of "hours" sent with it has passed. "manual": true with no place keeps the place
//              that is already there and only changes the message.
//
// And, separately, being away:
//   "away": true   says I am away, usually with a "message" ("Catching rays, back on Tuesday 14th"). The site
//                  shows it on the home and contact pages. The place still follows the automatic Shortcut, so
//                  it shows where I have gone; the away note stays with it until "away": false is sent, or
//                  the "hours" sent with it run out. With no place in the body, only the note changes.
//                  "back" can be sent instead of "hours": the day I return ("2026-10-14") or the exact
//                  moment (a full date and time). The away note ends by itself then.
//   "away": false  says I am back: the note goes.
//
// Only the town is kept: the coordinates are rounded to about ten kilometres before they are stored.
export async function POST(request: Request) {
  const token = await getKey("LOCATION_TOKEN");
  const sent = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || token.length < 12 || !same(sent, token)) return Response.json({ error: "Not allowed" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { name?: string; lat?: number | string; lon?: number | string; timeZone?: string; message?: string; manual?: boolean | string; away?: boolean | string; hours?: number | string; back?: string };
  const flag = (v: unknown) => (v === true || v === "true" || v === 1 || v === "1" || v === "yes" ? true : v === false || v === "false" || v === 0 || v === "0" || v === "no" ? false : undefined);
  const settings = await getSettings();
  const was = settings.location;
  const manual = flag(body.manual), away = flag(body.away);
  const live = !was?.until || new Date(was.until).getTime() > Date.now();
  const pinned = !!was?.manual && live;
  const wasAway = !!was?.away && live;

  // An automatic update while a manual one is in force changes nothing.
  if (manual === undefined && away === undefined && pinned) return Response.json({ ok: true, kept: "manual", location: was });

  const lat = Number(body.lat), lon = Number(body.lon), name = String(body.name ?? "").trim().slice(0, 80);
  const placed = !!name && body.lat !== undefined && body.lon !== undefined && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  // Without a place this can only change the message or the mode of the place already there.
  if (!placed && ((manual === undefined && away === undefined) || !was)) return Response.json({ error: "Send a name, lat and lon" }, { status: 400 });

  let timeZone = was?.timeZone ?? "UTC";
  try {
    if (body.timeZone) {
      new Intl.DateTimeFormat("en-GB", { timeZone: body.timeZone });
      timeZone = body.timeZone;
    }
  } catch {}
  // While a place is held by hand, a message about being away does not move it.
  const place = placed && !(pinned && manual === undefined) ? { name, lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10, timeZone } : { name: was!.name, lat: was!.lat, lon: was!.lon, timeZone: placed ? was!.timeZone : timeZone };
  const hours = Number(body.hours);
  const message = String(body.message ?? "").trim().slice(0, 140);
  // When it ends by itself: either so many "hours" from now, or "back", the day (or the moment) I return.
  // A bare day ("2026-10-14") means the start of that day where I am.
  const back = String(body.back ?? "").trim();
  let ends = Number.isFinite(hours) && hours > 0 ? Date.now() + Math.min(hours, 24 * 60) * 3600000 : NaN;
  if (back) {
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(back);
    if (day) {
      // Midnight in my time zone, found by seeing how far that zone is from UTC on that day.
      const utc = Date.UTC(+day[1], +day[2] - 1, +day[3]);
      let shift = 0;
      try {
        const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(utc));
        const n = (t: string) => Number(parts.find((x) => x.type === t)?.value);
        shift = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute")) - utc;
      } catch {}
      ends = utc - shift;
    } else if (Number.isFinite(Date.parse(back))) ends = Date.parse(back);
  }
  const until = Number.isFinite(ends) && ends > Date.now() ? { until: new Date(ends).toISOString() } : {};
  // What carries over: being away outlasts automatic updates, and a held place outlasts an away message.
  const nowAway = away ?? wasAway;
  const nowManual = manual ?? pinned;
  const said = manual !== undefined || away !== undefined; // sent by hand, so its message and time limit are the new ones
  const note = said ? message || (away === false ? "" : nowAway || nowManual ? was?.message ?? "" : "") : nowAway || nowManual ? was?.message ?? "" : "";
  const keepUntil = said ? until : was?.until && live && (nowAway || nowManual) ? { until: was.until } : {};
  const location = { ...place, ...(nowManual ? { manual: true } : {}), ...(nowAway ? { away: true } : {}), ...(note && (nowAway || nowManual) ? { message: note } : {}), ...(nowAway || nowManual ? keepUntil : {}) };
  await saveSettings({ ...settings, location });
  return Response.json({ ok: true, mode: nowManual ? "manual" : "automatic", away: nowAway, location });
}
