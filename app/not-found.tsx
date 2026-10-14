import type { Metadata } from "next";
import { Lost } from "@/components/Lost";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: `No such page · ${site.name}` };

export default function NotFound() {
  return <Lost code={404} />;
}
