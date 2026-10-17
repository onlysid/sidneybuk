import { guard } from "@/lib/server/auth";
import { finishRegistration, listPasskeys, registrationOptions, removePasskey, setTwoStep, twoStep } from "@/lib/server/passkeys";

export const dynamic = "force-dynamic";

// The passkeys that can open the admin area (signed in only).
//   GET              the list, and whether a passkey is required after the password
//   PUT              a challenge for adding one
//   POST {answer, name}   finish adding one
//   PATCH {twoStep}  require a passkey after the password, or not
//   DELETE ?id=      remove one
export async function GET(request: Request) {
  const no = await guard(request);
  if (no) return no;
  return Response.json({ passkeys: await listPasskeys(), twoStep: await twoStep() });
}
export async function PUT(request: Request) {
  const no = await guard(request);
  if (no) return no;
  return Response.json(await registrationOptions());
}
export async function POST(request: Request) {
  const no = await guard(request);
  if (no) return no;
  try {
    const { answer, name } = await request.json();
    await finishRegistration(answer, String(name ?? ""));
    return Response.json({ passkeys: await listPasskeys(), twoStep: await twoStep() });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
export async function PATCH(request: Request) {
  const no = await guard(request);
  if (no) return no;
  const { twoStep: on } = await request.json();
  // Never lock the door with no key: the second step needs at least one passkey.
  if (on && !(await listPasskeys()).length) return Response.json({ error: "Add a passkey first." }, { status: 400 });
  await setTwoStep(!!on);
  return Response.json({ passkeys: await listPasskeys(), twoStep: await twoStep() });
}
export async function DELETE(request: Request) {
  const no = await guard(request);
  if (no) return no;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  await removePasskey(id);
  const left = await listPasskeys();
  // The last passkey going means the password must be enough again.
  if (!left.length) await setTwoStep(false);
  return Response.json({ passkeys: left, twoStep: await twoStep() });
}
