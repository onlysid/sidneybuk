// Bundles the site's own components into one HTML file for the in-chat preview.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const out = process.argv[2];
const here = (p) => resolve(import.meta.dirname, p);
// The recorded instruments go inside the preview too, so it sounds much the same there as on the real site.
// The preview has a size limit, so (where ffmpeg is to hand) its copies are packed a little tighter than the
// site's own files; the smaller copies are kept in .out so this is only done once.
mkdirSync(here(".out/small"), { recursive: true });
const packed = (kit, f) => {
  const from = here(`../public/sounds/${kit}/${f}`), to = here(`.out/small/${kit}-${f}`);
  if (!existsSync(to)) {
    try {
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", from, "-ac", "1", "-b:a", "40k", to]);
    } catch {
      return readFileSync(from);
    }
  }
  return readFileSync(to);
};
const sounds = Object.fromEntries(["piano", "guitar"].flatMap((kit) => readdirSync(here(`../public/sounds/${kit}`)).map((f) => [`${kit}/${f}`, packed(kit, f).toString("base64")])));
writeFileSync(here(".out/sounds.json"), JSON.stringify(sounds));
await build({
  entryPoints: [here("entry.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  jsx: "automatic",
  outdir: here(".out"),
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".svg": "base64", ".jpg": "base64", ".png": "base64", ".wav": "base64", ".txt": "base64", ".musicxml": "text" },
  alias: { "next/navigation": here("shims/navigation.ts"), "@/lib/assets": here("shims/assets.ts"), "@/lib/admin/api": here("shims/admin-api.ts"), "next/dynamic": here("shims/dynamic.tsx"), "world-atlas/countries-50m.json": here("countries-50m-small.json") },
  // (The preview has a size limit: its copy of the detailed world outline is stored a little more coarsely.)
  tsconfig: here("../tsconfig.json"),
});
// The publisher that hosts the preview mistook one build for a different kind of page because of a shortened
// variable name the bundler happened to choose ("iD", sitting directly before an embedded picture). The name is
// changed here, where it is declared and where it is used, so that cannot happen again.
const js = readFileSync(here(".out/entry.js"), "utf8").replaceAll("</script", "<\\/script").replace(/(?<=var |,)(iD|ID|Id|id)(?==")/g, "$1$").replace(/\$\{(iD|ID|Id|id)\}/g, "${$1$}");
const css = readFileSync(here(".out/entry.css"), "utf8");
writeFileSync(
  out,
  `<title>sidneyb.uk Site Preview</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..700&family=Instrument+Sans:wght@400..600&family=JetBrains+Mono:wght@400..500&display=swap">
<style>${css}
/* The preview sits inside another page that already keeps clear of the notch, so the site's own allowance for it would double up. */
body { padding-top: 0; } .dock-wrap { top: 12px; } .progress { top: 0; } html { scroll-padding-top: 96px; }
.pv-try { position: fixed; left: 10px; bottom: 86px; z-index: 18; display: none; align-items: center; gap: 4px; padding: 4px 6px 4px 10px; border-radius: 999px; border: 1px solid var(--edge); background: color-mix(in srgb, var(--bg) 80%, transparent); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); font-size: 0.7rem; }
.pv-try[data-on="true"] { display: flex; }
.pv-try .mono { font-size: 0.6rem; margin-right: 2px; }
.pv-try button { border: 0; background: none; color: var(--text); font: inherit; font-family: var(--mono); font-size: 0.72rem; padding: 5px 8px; border-radius: 999px; cursor: pointer; }
.pv-try button:hover { background: var(--accent); color: var(--on-accent); }</style>
<div id="root"></div>
<script>${js}</script>
`,
);
console.log("wrote", out, Math.round((js.length + css.length) / 1024) + " KB");
