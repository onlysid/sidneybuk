import { guard } from "@/lib/server/auth";
import { disconnect, stravaStatus, sync } from "@/lib/server/sport";

export const dynamic = "force-dynamic";

// Is Strava connected, and how much has been brought in?
export async function GET(request: Request) {
  const stop = await guard(request);
  if (stop) return stop;
  return Response.json(await stravaStatus());
}
// { action: "sync" | "full" | "disconnect" }
export async function POST(request: Request) {
  const stop = await guard(request);
  if (stop) return stop;
  const { action } = (await request.json().catch(() => ({}))) as { action?: string };
  try {
    if (action === "disconnect") await disconnect();
    else if (action === "sync" || action === "full") return Response.json({ ...(await sync(action === "full")), status: await stravaStatus() });
    else return Response.json({ error: "Unknown action" }, { status: 400 });
    return Response.json({ status: await stravaStatus() });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
