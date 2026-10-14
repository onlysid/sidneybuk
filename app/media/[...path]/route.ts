import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { TYPES, uploadDir } from "@/lib/server/files";

// Serves an uploaded file. Supports the "Range" requests that audio and video players make when seeking.
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const root = uploadDir();
  const file = path.join(/* turbopackIgnore: true */ root, ...parts);
  const ext = (parts.at(-1)?.split(".").pop() ?? "").toLowerCase();
  if (!file.startsWith(root + path.sep) || !TYPES[ext]) return new Response("Not found", { status: 404 });
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return new Response("Not found", { status: 404 });
  const headers: Record<string, string> = { "Content-Type": TYPES[ext], "Cache-Control": "public, max-age=31536000, immutable", "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start > end || start >= info.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": String(end - start + 1) } });
  }
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers: { ...headers, "Content-Length": String(info.size) } });
}
