import type { Metadata } from "next";
import { site } from "@/lib/site";
import { ActivitiesView } from "@/views/SportViews";

export const metadata: Metadata = { title: `Activities · Sport · ${site.name}`, description: "Every run, ride, match and session." };

export default function Page() {
  return <ActivitiesView />;
}
