import { guard } from "@/lib/server/auth";
import { deleteEntry, getEntry, saveEntry } from "@/lib/server/store";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function GET(request: Request, { params }: Params) {
  const stop = await guard(request);
  if (stop) return stop;
  const { id } = await params;
  const entry = isId(id) ? await getEntry(id) : null;
  return entry ? Response.json({ entry }) : Response.json({ error: "Not found" }, { status: 404 });
}
export async function PUT(request: Request, { params }: Params) {
  const stop = await guard(request);
  if (stop) return stop;
  const { id } = await params;
  const before = isId(id) ? await getEntry(id) : null;
  if (!before) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.data !== "object") return Response.json({ error: "Nothing to save" }, { status: 400 });
  try {
    return Response.json({ entry: await saveEntry(before.kind, { id, slug: body.slug, data: body.data, published: body.published, position: body.position }) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
export async function DELETE(request: Request, { params }: Params) {
  const stop = await guard(request);
  if (stop) return stop;
  const { id } = await params;
  if (isId(id)) await deleteEntry(id);
  return Response.json({ ok: true });
}
