import { cvPdf, type Theme } from "@/lib/cv/pdf";
import { getCv } from "@/lib/server/cv";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

// The CV as a PDF: /cv/pdf?theme=light (the default) or ?theme=dark. Add &download=1 to save rather than open.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const theme: Theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
  const cv = await getCv();
  const bytes = await cvPdf(cv, theme);
  const name = `${site.name} CV${theme === "dark" ? " (dark)" : ""}.pdf`;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename="${name}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-cache",
      "Last-Modified": new Date(cv.updatedAt).toUTCString(),
    },
  });
}
