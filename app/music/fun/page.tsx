import type { Metadata } from "next";
import { site } from "@/lib/site";
import { MusicFunView } from "@/views/MusicViews";

export const metadata: Metadata = { title: `The fun stuff · Music · ${site.name}`, description: "Instruments to play, temperaments, time signatures and the science of a note." };

export default function Page() {
  return <MusicFunView />;
}
