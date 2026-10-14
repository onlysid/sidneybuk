import type { Metadata } from "next";
import { site } from "@/lib/site";
import { RideView } from "@/views/TrainingViews";

export const metadata: Metadata = { title: `Cycling · Sport · ${site.name}`, description: "Every ride: how far, how fast, how much climbing, and what sort of ride it was." };

export default function Page() {
  return <RideView />;
}
