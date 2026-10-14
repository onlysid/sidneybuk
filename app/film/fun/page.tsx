import type { Metadata } from "next";
import { site } from "@/lib/site";
import { FilmFunView } from "@/views/FilmViews";

export const metadata: Metadata = { title: `The fun stuff · Film and photo · ${site.name}`, description: "Aperture, bokeh, lenses, focal length, shutter speed and light, in things you can drag." };

export default function Page() {
  return <FilmFunView />;
}
