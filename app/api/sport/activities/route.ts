import { getList } from "@/lib/server/sport";

export const dynamic = "force-dynamic";

// The list of activities, a page at a time: ?sport=Run&year=2026&q=tempo&offset=30
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const year = p.get("year") ?? "";
  return Response.json(await getList({ sport: (p.get("sport") ?? "").slice(0, 40), year: /^\d{4}$/.test(year) ? year : "", q: (p.get("q") ?? "").slice(0, 80), offset: Math.max(0, Number(p.get("offset")) || 0), limit: 30 }));
}
