import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// What a phone or computer needs to install the site as an app: its name, icon and colours, and a few shortcuts (press and hold the icon) to the…
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.domain,
    description: site.intro,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#201A26",
    theme_color: "#201A26",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // The pictures fill the whole square (as app icons do), and still read when cut to a circle or a squircle.
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Gym today", url: "/admin/gym" },
      { name: "Add cards", url: "/admin/cards" },
      { name: "Write up training", url: "/admin/activities" },
      { name: "Admin", url: "/admin" },
    ],
  };
}
