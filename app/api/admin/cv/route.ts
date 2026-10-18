import { guard } from "@/lib/server/auth";
import { getCv, saveCv } from "@/lib/server/cv";

export const dynamic = "force-dynamic";

// The CV's text (signed in only). GET reads it, PUT replaces it and stamps the time.
export async function GET(request: Request) {
  const no = await guard(request);
  if (no) return no;
  return Response.json(await getCv());
}
export async function PUT(request: Request) {
  const no = await guard(request);
  if (no) return no;
  try {
    return Response.json(await saveCv(await request.json()));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
