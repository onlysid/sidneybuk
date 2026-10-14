import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { signedIn } from "@/lib/server/auth";
import { getContent, getDraftPost } from "@/lib/server/store";
import { site } from "@/lib/site";
import { PostView } from "@/views/BlogView";

// Read from the database on each visit, so something saved in the admin area shows straight away.
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ post: string }> };
const find = async (p: { post: string }) => (await getContent()).posts.find((post) => post.slug === p.post);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await find(await params);
  return post ? { title: `${post.title} · ${site.name}`, description: post.summary } : {};
}

export default async function Page({ params }: Params) {
  const { post: slug } = await params;
  let post = await find({ post: slug });
  if (!post) {
    // A draft: the owner sees it as a preview; anyone else is told it is not for them.
    const draft = await getDraftPost(slug);
    if (!draft) notFound();
    if (!(await signedIn())) forbidden();
    post = draft;
  }
  return <PostView post={post} />;
}
