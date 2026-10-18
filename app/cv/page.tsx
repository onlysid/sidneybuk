import type { Metadata } from "next";
import { getCv } from "@/lib/server/cv";
import { site } from "@/lib/site";
import { CvView } from "@/views/CvView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `CV · ${site.name}`, description: `${site.name}'s CV: experience, skills and education, as a page and as a PDF.` };

export default async function Page() {
  return <CvView cv={await getCv()} />;
}
