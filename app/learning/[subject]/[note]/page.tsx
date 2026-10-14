import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/lib/server/store";
import { site } from "@/lib/site";
import { NoteView, TopicView } from "@/views/LearningViews";

// Under a subject there are topics and notes, sharing one kind of address: /learning/<subject>/<either>.
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ subject: string; note: string }> };
const find = async (p: { subject: string; note: string }) => {
  const content = await getContent();
  return { topic: content.topics.find((t) => t.subject === p.subject && t.slug === p.note), note: content.notes.find((n) => n.subject === p.subject && n.slug === p.note) };
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { topic, note } = await find(await params);
  return topic ? { title: `${topic.title} · Learning · ${site.name}`, description: topic.short } : note ? { title: `${note.title} · ${site.name}`, description: note.summary } : {};
}

export default async function Page({ params }: Params) {
  const { topic, note } = await find(await params);
  if (topic) return <TopicView topic={topic} />;
  if (!note) notFound();
  return <NoteView note={note} />;
}
