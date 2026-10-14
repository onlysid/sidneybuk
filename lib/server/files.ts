import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { query } from "./db";

// Uploaded files live in this folder on disk (a Docker volume in production) and are served at /media/….
export const uploadDir = () => path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./data/uploads");

// What may be uploaded, and what each is served as. (No SVG or HTML: those can carry scripts.)
export const TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", gif: "image/gif",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", flac: "audio/flac",
  mp4: "video/mp4", webm: "video/webm",
  pdf: "application/pdf", musicxml: "application/xml", xml: "application/xml", mxl: "application/vnd.recordare.musicxml", mid: "audio/midi", txt: "text/plain; charset=utf-8",
};
const MOST = 200 * 1024 * 1024;

export type Media = { id: string; url: string; name: string; mime: string; size: number; createdAt: string };
type Row = { id: string; path: string; name: string; mime: string; size: number; created_at: Date };
const toMedia = (r: Row): Media => ({ id: r.id, url: `/media/${r.path}`, name: r.name, mime: r.mime, size: r.size, createdAt: r.created_at.toISOString() });

export async function saveUpload(file: File) {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!TYPES[ext]) throw new Error(`Files ending .${ext || "?"} cannot be uploaded. Allowed: ${Object.keys(TYPES).join(", ")}.`);
  if (file.size > MOST) throw new Error("That file is bigger than 200 MB.");
  const tidy = file.name.replace(/\.[^.]+$/, "").normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).toLowerCase() || "file";
  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const rel = `${folder}/${tidy}-${randomBytes(4).toString("hex")}.${ext}`;
  await mkdir(path.join(/* turbopackIgnore: true */ uploadDir(), folder), { recursive: true });
  await writeFile(path.join(/* turbopackIgnore: true */ uploadDir(), rel), Buffer.from(await file.arrayBuffer()));
  const rows = await query<Row>("insert into media (path, name, mime, size) values ($1, $2, $3, $4) returning *", [rel, file.name, TYPES[ext], file.size]);
  return toMedia(rows[0]);
}
export async function listMedia() {
  return (await query<Row>("select * from media order by created_at desc limit 500")).map(toMedia);
}
export async function deleteMedia(id: string) {
  const rows = await query<Row>("delete from media where id = $1 returning *", [id]);
  if (rows[0]) await unlink(path.join(/* turbopackIgnore: true */ uploadDir(), rows[0].path)).catch(() => {});
}
