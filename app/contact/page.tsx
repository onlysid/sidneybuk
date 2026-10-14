import type { Metadata } from "next";
import { site } from "@/lib/site";
import { ContactView } from "@/views/ContactView";

export const metadata: Metadata = { title: `Contact · ${site.name}`, description: "Get in touch with Sidney Brown." };

export default function Page() {
  return <ContactView />;
}
