import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActivity } from "@/lib/server/sport";
import { dayOf, sportName } from "@/lib/sport";
import { site } from "@/lib/site";
import { ActivityView } from "@/views/SportViews";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const a = await getActivity((await params).id);
  return a ? { title: `${a.name} · Sport · ${site.name}`, description: `${sportName(a.sport)}, ${dayOf(a.start)}` } : {};
}

export default async function Page({ params }: Params) {
  const activity = await getActivity((await params).id);
  if (!activity) notFound();
  return <ActivityView activity={activity} />;
}
