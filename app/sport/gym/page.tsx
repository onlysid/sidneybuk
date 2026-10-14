import type { Metadata } from "next";
import { site } from "@/lib/site";
import { GymView } from "@/views/TrainingViews";

export const metadata: Metadata = { title: `Gym · Sport · ${site.name}`, description: "The weight on each machine, visit by visit." };

export default function Page() {
  return <GymView />;
}
