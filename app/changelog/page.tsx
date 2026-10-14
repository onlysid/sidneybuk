import type { Metadata } from "next";
import { site } from "@/lib/site";
import { ChangelogView } from "@/views/ChangelogView";

export const metadata: Metadata = { title: `Changelog · ${site.name}`, description: "What has been added to this site, fixed or made better." };

export default function Page() {
  return <ChangelogView />;
}
