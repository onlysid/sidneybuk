import { getRides } from "@/lib/server/sport";

export const dynamic = "force-dynamic";

// Every ride with what was written on it: the sort of ride, the bike, who came.
export async function GET() {
  return Response.json(await getRides(), { headers: { "Cache-Control": "public, max-age=60" } });
}
