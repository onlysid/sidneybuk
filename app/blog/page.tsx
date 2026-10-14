import type { Metadata } from "next";
import { site } from "@/lib/site";
import { BlogView } from "@/views/BlogView";

export const metadata: Metadata = { title: `Blog · ${site.name}`, description: "Notes on code, maths, music and whatever else I am working out." };

export default function Page() {
  return <BlogView />;
}
