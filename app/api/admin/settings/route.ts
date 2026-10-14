import { guard } from "@/lib/server/auth";
import { getSettings, keyStatus, saveSettings, setKey } from "@/lib/server/store";

export const dynamic = "force-dynamic";

// The site settings, and which API keys are set (never their values).
export async function GET(request: Request) {
  const stop = await guard(request);
  if (stop) return stop;
  return Response.json({ settings: await getSettings(), keys: await keyStatus() });
}
// Save settings, and/or set or clear keys: { settings?, keys?: { NAME: "value" or "" to clear } }.
export async function PUT(request: Request) {
  const stop = await guard(request);
  if (stop) return stop;
  const body = (await request.json().catch(() => ({}))) as { settings?: Parameters<typeof saveSettings>[0]; keys?: Record<string, string> };
  try {
    if (body.settings) await saveSettings(body.settings);
    for (const [name, value] of Object.entries(body.keys ?? {})) await setKey(name, String(value).trim());
    return Response.json({ settings: await getSettings(), keys: await keyStatus() });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
