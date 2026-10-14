import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/lib/server/store";
import { site } from "@/lib/site";
import { BookView } from "@/views/ReadingViews";

// Read from the database on each visit, so something saved in the admin area shows straight away.
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ book: string }> };
const find = async (p: { book: string }) => (await getContent()).books.find((book) => book.slug === p.book);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const book = await find(await params);
  return book ? { title: `${book.title}, ${book.author} · ${site.name}`, description: book.review || `${book.title} by ${book.author}` } : {};
}

export default async function Page({ params }: Params) {
  const book = await find(await params);
  if (!book) notFound();
  return <BookView book={book} />;
}
