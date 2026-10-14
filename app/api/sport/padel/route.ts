import { getPadel } from "@/lib/server/sport";

export const dynamic = "force-dynamic";

// Every padel session with what was written on it: match or training, and the score.
export async function GET() {
  return Response.json(await getPadel(), { headers: { "Cache-Control": "public, max-age=60" } });
}
