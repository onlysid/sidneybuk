import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { bySlug, disciplines, site, type Slug } from "@/lib/site";
import { DisciplineView } from "@/views/DisciplineView";

export const dynamicParams = false;
export const generateStaticParams = () => disciplines.map((d) => ({ slug: d.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const item = bySlug((await params).slug);
  return item ? { title: `${item.title} · ${site.name}`, description: item.short } : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!bySlug(slug)) notFound();
  return <DisciplineView slug={slug as Slug} />;
}
