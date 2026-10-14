import type { Metadata } from "next";
import { site } from "@/lib/site";
import { PrivacyView } from "@/views/PrivacyView";

export const metadata: Metadata = { title: `Privacy · ${site.name}`, description: "What this site does with information about you." };

export default function Page() {
  return <PrivacyView />;
}
