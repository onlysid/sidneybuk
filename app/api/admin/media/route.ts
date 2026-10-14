import { guard } from "@/lib/server/auth";
import { deleteMedia, listMedia, saveUpload } from "@/lib/server/files";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const stop = await guard(request);
  if (stop) return stop;
  return Response.json({ media: await listMedia() });
}
// Upload one file (a form with a "file" field).
export async function POST(request: Request) {
  const stop = await guard(request);
  if (stop) return stop;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file was sent" }, { status: 400 });
  try {
    return Response.json({ media: await saveUpload(file) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
export async function DELETE(request: Request) {
  const stop = await guard(request);
  if (stop) return stop;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (/^[0-9a-f-]{36}$/i.test(id)) await deleteMedia(id);
  return Response.json({ ok: true });
}
