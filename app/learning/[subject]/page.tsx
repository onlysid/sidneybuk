import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/lib/server/store";
import { site } from "@/lib/site";
import { SubjectView } from "@/views/LearningViews";

// Read from the database on each visit, so something saved in the admin area shows straight away.
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ subject: string }> };
const find = async (p: { subject: string }) => (await getContent()).subjects.find((subject) => subject.slug === p.subject);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const subject = await find(await params);
  return subject ? { title: `${subject.title} · Learning · ${site.name}`, description: subject.short } : {};
}

export default async function Page({ params }: Params) {
  const subject = await find(await params);
  if (!subject) notFound();
  return <SubjectView subject={subject} />;
}
