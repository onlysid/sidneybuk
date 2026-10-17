import "server-only";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse, type AuthenticationResponseJSON, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { cookies, headers } from "next/headers";
import { query } from "./db";
import { sign, same } from "./secrets";
import { site } from "@/lib/site";

// Passkeys for the admin area: Face ID, Touch ID, a password manager or a security key, instead of (or on top
// of) the password. Each registered device or manager is one row in the passkeys table.

export type Passkey = { id: string; name: string; createdAt: string; lastUsedAt: string | null; transports: string[] };
type Row = { id: string; public_key: string; counter: string; transports: string[]; name: string; created_at: Date; last_used_at: Date | null };

const toKey = (r: Row): Passkey => ({ id: r.id, name: r.name, createdAt: r.created_at.toISOString(), lastUsedAt: r.last_used_at?.toISOString() ?? null, transports: r.transports });

export async function listPasskeys() {
  return (await query<Row>("select * from passkeys order by created_at")).map(toKey);
}
export async function removePasskey(id: string) {
  await query("delete from passkeys where id = $1", [id]);
}

// Whether the password alone is enough, or a passkey must follow it. Kept in the settings table.
export async function twoStep() {
  const rows = await query<{ value: { on?: boolean } }>("select value from settings where key = 'security'");
  return !!rows[0]?.value?.on;
}
export async function setTwoStep(on: boolean) {
  await query("insert into settings (key, value) values ('security', $1) on conflict (key) do update set value = excluded.value", [JSON.stringify({ on })]);
}

// The site's identity for WebAuthn: its host name, and the full origin the browser is talking to.
async function party() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? new URL(site.url).host).split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")).split(",")[0].trim();
  return { rpID: host.replace(/:\d+$/, ""), origin: `${proto}://${host}` };
}

// The challenge travels in a short-lived signed cookie between the two halves of each ceremony.
const CHALLENGE = "passkey-challenge";
async function keep(challenge: string) {
  const until = String(Date.now() + 5 * 60000);
  (await cookies()).set(CHALLENGE, `${challenge}.${until}.${sign(challenge + until)}`, { httpOnly: true, sameSite: "strict", secure: (await party()).origin.startsWith("https"), path: "/api/admin", maxAge: 300 });
}
async function take() {
  const jar = await cookies();
  const [challenge, until, mark] = (jar.get(CHALLENGE)?.value ?? "").split(".");
  jar.delete({ name: CHALLENGE, path: "/api/admin" });
  if (!challenge || !until || !mark || !same(mark, sign(challenge + until)) || Number(until) < Date.now()) return null;
  return challenge;
}

// ---- Adding one (signed in) ---------------------------------------------------------------------------------------
export async function registrationOptions() {
  const { rpID } = await party();
  const have = await query<Row>("select id, transports from passkeys");
  const options = await generateRegistrationOptions({
    rpName: site.domain,
    rpID,
    userName: site.email,
    userDisplayName: site.name,
    userID: new TextEncoder().encode("admin"),
    attestationType: "none",
    excludeCredentials: have.map((k) => ({ id: k.id, transports: k.transports as never })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });
  await keep(options.challenge);
  return options;
}
export async function finishRegistration(response: RegistrationResponseJSON, name: string) {
  const challenge = await take();
  if (!challenge) throw new Error("This took too long. Try again.");
  const { rpID, origin } = await party();
  const { verified, registrationInfo } = await verifyRegistrationResponse({ response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID });
  if (!verified || !registrationInfo) throw new Error("The browser's answer did not check out.");
  const { credential } = registrationInfo;
  await query("insert into passkeys (id, public_key, counter, transports, name) values ($1, $2, $3, $4, $5)", [
    credential.id,
    Buffer.from(credential.publicKey).toString("base64url"),
    credential.counter,
    JSON.stringify(credential.transports ?? []),
    name.slice(0, 60),
  ]);
}

// ---- Signing in with one ------------------------------------------------------------------------------------------
export async function authenticationOptions() {
  const { rpID } = await party();
  const have = await query<Row>("select id, transports from passkeys");
  if (!have.length) throw new Error("No passkey has been added yet.");
  const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred", allowCredentials: have.map((k) => ({ id: k.id, transports: k.transports as never })) });
  await keep(options.challenge);
  return options;
}
export async function finishAuthentication(response: AuthenticationResponseJSON) {
  const challenge = await take();
  if (!challenge) throw new Error("This took too long. Try again.");
  const { rpID, origin } = await party();
  const [row] = await query<Row>("select * from passkeys where id = $1", [response.id]);
  if (!row) throw new Error("That passkey is not one of mine.");
  const { verified, authenticationInfo } = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: { id: row.id, publicKey: new Uint8Array(Buffer.from(row.public_key, "base64url")), counter: Number(row.counter), transports: row.transports as never },
  });
  if (!verified) throw new Error("The passkey did not check out.");
  await query("update passkeys set counter = $2, last_used_at = now() where id = $1", [row.id, authenticationInfo.newCounter]);
  return toKey(row);
}
