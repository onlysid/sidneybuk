import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/lib/server/store";
import { site } from "@/lib/site";
import { PlaceView } from "@/views/TravelViews";

// Read from the database on each visit, so something saved in the admin area shows straight away.
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ place: string }> };
const find = async (p: { place: string }) => (await getContent()).places.find((place) => place.slug === p.place);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const place = await find(await params);
  return place ? { title: `${place.name} · Travel · ${site.name}`, description: place.tagline } : {};
}

export default async function Page({ params }: Params) {
  const place = await find(await params);
  if (!place) notFound();
  return <PlaceView place={place} />;
}
