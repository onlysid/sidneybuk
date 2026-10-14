import { isKind } from "@/lib/admin/kinds";
import { guard } from "@/lib/server/auth";
import { listEntries, saveEntry } from "@/lib/server/store";

export const dynamic = "force-dynamic";

// Every entry of one kind, published or not.
export async function GET(request: Request) {
  const stop = await guard(request);
  if (stop) return stop;
  const kind = new URL(request.url).searchParams.get("kind") ?? "";
  if (!isKind(kind)) return Response.json({ error: "Unknown kind" }, { status: 400 });
  return Response.json({ entries: await listEntries(kind) });
}
// Make a new one.
export async function POST(request: Request) {
  const stop = await guard(request);
  if (stop) return stop;
  const body = await request.json().catch(() => null);
  if (!body || !isKind(body.kind) || typeof body.data !== "object") return Response.json({ error: "Nothing to save" }, { status: 400 });
  try {
    return Response.json({ entry: await saveEntry(body.kind, { slug: body.slug, data: body.data, published: body.published, position: body.position }) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
