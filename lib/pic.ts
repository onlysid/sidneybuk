// Pictures at the size they are shown, rather than the size they were uploaded.
//
// The site's own image service (Next's, at /_next/image) resizes a picture to a given width and sends it as
// AVIF or WebP, whichever the browser takes, and keeps the result. These helpers write the addresses for it.
// Pictures from this site go through it, and so do book covers, App Store screenshots and YouTube thumbnails,
// which are slow from their own servers; anything else is left as it is.

export const WIDTHS = [320, 480, 640, 828, 1080, 1200, 1920] as const;

// Pictures from here, and from the few other places whose pictures the site shows (listed again in next.config.ts).
const ELSEWHERE = [/^https:\/\/covers\.openlibrary\.org\//, /^https:\/\/[a-z0-9-]+\.mzstatic\.com\//, /^https:\/\/i\.ytimg\.com\//];
const ours = (src: string) => (src.startsWith("/") && !src.startsWith("//") && !src.startsWith("/_next/")) || ELSEWHERE.some((re) => re.test(src));
const fits = (w: number) => WIDTHS.reduce((best, x) => (Math.abs(x - w) < Math.abs(best - w) ? x : best), WIDTHS[0]);

// One address at (about) this width.
export function picAt(src: string, width: number, quality = 78) {
  if (!ours(src) || /\.(svg|gif)$/i.test(src)) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${fits(width)}&q=${quality}`;
}

// The srcset for a picture that may be shown up to this wide (in CSS pixels), with 2× screens in mind.
export function picSet(src: string, upTo: number, quality = 78) {
  if (!ours(src) || /\.(svg|gif)$/i.test(src)) return undefined;
  const top = Math.min(WIDTHS[WIDTHS.length - 1], fits(upTo * 2));
  return WIDTHS.filter((w) => w <= top)
    .map((w) => `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${quality} ${w}w`)
    .join(", ");
}
