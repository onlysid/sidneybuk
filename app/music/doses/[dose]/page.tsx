import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/lib/server/store";
import { site } from "@/lib/site";
import { DoseView } from "@/views/MusicViews";

// Read from the database on each visit, so something saved in the admin area shows straight away.
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ dose: string }> };
const find = async (p: { dose: string }) => (await getContent()).doses.find((dose) => dose.slug === p.dose);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const dose = await find(await params);
  return dose ? { title: `${dose.title} · ${site.name}`, description: dose.note } : {};
}

export default async function Page({ params }: Params) {
  const dose = await find(await params);
  if (!dose) notFound();
  return <DoseView dose={dose} />;
}
