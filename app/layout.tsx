import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ContentProvider } from "@/components/Content";
import { Shell } from "@/components/Shell";
import { getContent } from "@/lib/server/store";
import { site } from "@/lib/site";

// The three typefaces, served from here and announced in the page's head so the browser fetches them with
// the page rather than after the stylesheet; each gets a matched fallback so text barely shifts when it lands.
const display = localFont({ src: "./fonts/bricolage.woff2", variable: "--font-display", display: "swap", adjustFontFallback: "Arial" });
const body = localFont({ src: "./fonts/instrument.woff2", variable: "--font-body", display: "swap", adjustFontFallback: "Arial" });
const mono = localFont({ src: "./fonts/jetbrains.woff2", variable: "--font-mono", display: "swap", adjustFontFallback: "Times New Roman" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: `${site.name} · ${site.role}`,
  description: site.intro,
  // For installing as an app. (The manifest itself is app/manifest.ts, which Next links by itself.)
  applicationName: site.domain,
  appleWebApp: { capable: true, title: site.domain, statusBarStyle: "black-translucent" },
  openGraph: { title: `${site.name} · ${site.role}`, description: site.intro, url: site.url, siteName: site.domain, type: "website" },
};

export const viewport: Viewport = {
  // Lets the page run under the status bar when installed as an app; the menu and the bar keep clear of it.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#201A26" },
    { media: "(prefers-color-scheme: light)", color: "#F3EEF2" },
  ],
};

// Runs before paint so a saved theme never flashes the wrong colours.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

// Every page reads its content from the database when it is asked for, never from a copy made at build time.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const content = await getContent();
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ContentProvider value={content}>
          <Shell>{children}</Shell>
        </ContentProvider>
      </body>
    </html>
  );
}
