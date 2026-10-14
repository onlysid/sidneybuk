import { getLog } from "@/lib/server/sport";

export const dynamic = "force-dynamic";

// The run log: every run with its notes, and the health numbers, for the page to add up a quarter at a time.
export async function GET() {
  return Response.json(await getLog(), { headers: { "Cache-Control": "public, max-age=60" } });
}
