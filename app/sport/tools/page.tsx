import type { Metadata } from "next";
import { site } from "@/lib/site";
import { SportToolsView } from "@/views/SportViews";

export const metadata: Metadata = { title: `Tools · Sport · ${site.name}`, description: "A pace calculator, VO2 max for your age, padel levels, BMI and a reaction test." };

export default function Page() {
  return <SportToolsView />;
}
