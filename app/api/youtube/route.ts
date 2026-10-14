import { getContent } from "@/lib/server/store";

// My latest YouTube uploads, read from the channel's public feed. No key needed: only the channel ID,
// set in the admin area under Settings. Without it this answers { configured: false }.
export const dynamic = "force-dynamic";

const pick = (xml: string, tag: string) => new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`).exec(xml)?.[1] ?? "";
const plain = (text: string) => text.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export async function GET() {
  const channel = (await getContent()).settings.integrations.youtubeChannelId;
  if (!channel) return Response.json({ configured: false });
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel}`, { next: { revalidate: 1800 } });
    // A channel with no uploads yet has no feed, or an empty one: that is not a fault.
    if (!res.ok) return Response.json({ configured: true, videos: [] });
    const xml = await res.text();
    const videos = xml
      .split("<entry>")
      .slice(1, 7)
      .map((entry) => {
        const id = pick(entry, "yt:videoId");
        return { id, title: plain(pick(entry, "title")), date: pick(entry, "published"), url: `https://www.youtube.com/watch?v=${id}`, image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
      })
      .filter((v) => v.id);
    return Response.json({ configured: true, videos }, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } });
  } catch {
    return Response.json({ configured: false });
  }
}
