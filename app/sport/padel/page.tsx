import type { Metadata } from "next";
import { site } from "@/lib/site";
import { PadelView } from "@/views/TrainingViews";

export const metadata: Metadata = { title: `Padel · Sport · ${site.name}`, description: "Matches, friendlies and training, with the scores." };

export default function Page() {
  return <PadelView />;
}
