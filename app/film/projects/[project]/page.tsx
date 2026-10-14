import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/lib/server/store";
import { site } from "@/lib/site";
import { ProjectView } from "@/views/FilmViews";

// Read from the database on each visit, so something saved in the admin area shows straight away.
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ project: string }> };
const find = async (p: { project: string }) => (await getContent()).projects.find((project) => project.slug === p.project);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const project = await find(await params);
  return project ? { title: `${project.title} · ${site.name}`, description: project.note } : {};
}

export default async function Page({ params }: Params) {
  const project = await find(await params);
  if (!project) notFound();
  return <ProjectView project={project} />;
}
