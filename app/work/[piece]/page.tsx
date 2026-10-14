import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { work, workBySlug } from "@/lib/portfolio";
import { site } from "@/lib/site";
import { WorkView } from "@/views/WorkView";

export const dynamicParams = false;
export const generateStaticParams = () => work.map((p) => ({ piece: p.slug }));

export async function generateMetadata({ params }: { params: Promise<{ piece: string }> }): Promise<Metadata> {
  const piece = workBySlug((await params).piece);
  return piece ? { title: `${piece.title} · ${site.name}`, description: piece.note } : {};
}

export default async function Page({ params }: { params: Promise<{ piece: string }> }) {
  const piece = workBySlug((await params).piece);
  if (!piece) notFound();
  return <WorkView piece={piece} />;
}
