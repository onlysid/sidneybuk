import type { Metadata } from "next";
import { site } from "@/lib/site";
import { RunLogView } from "@/views/TrainingViews";

export const metadata: Metadata = { title: `Run log · Sport · ${site.name}`, description: "Every run, a quarter at a time: the kind of run, how it went, and what it added up to." };

export default function Page() {
  return <RunLogView />;
}
