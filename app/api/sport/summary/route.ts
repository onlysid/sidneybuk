import { getSummary } from "@/lib/server/sport";

export const dynamic = "force-dynamic";

// Everything the sport page adds up: a month-by-month total for each sport, best efforts, the latest few
// activities and the health numbers.
export async function GET() {
  return Response.json(await getSummary(), { headers: { "Cache-Control": "public, max-age=60" } });
}
