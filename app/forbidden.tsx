import type { Metadata } from "next";
import { Lost } from "@/components/Lost";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: `Not this one · ${site.name}` };

export default function Forbidden() {
  return <Lost code={403} />;
}
