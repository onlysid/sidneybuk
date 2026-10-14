import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/lib/server/store";
import { site } from "@/lib/site";
import { PieceView } from "@/views/MusicViews";

// Read from the database on each visit, so something saved in the admin area shows straight away.
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ piece: string }> };
const find = async (p: { piece: string }) => (await getContent()).repertoire.find((piece) => piece.slug === p.piece);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const piece = await find(await params);
  return piece ? { title: `${piece.title}, ${piece.composer} · ${site.name}`, description: piece.note } : {};
}

export default async function Page({ params }: Params) {
  const piece = await find(await params);
  if (!piece) notFound();
  return <PieceView piece={piece} />;
}
