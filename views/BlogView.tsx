"use client";

import { useContent } from "@/components/Content";
import { Footer } from "@/components/Footer";
import { PostList } from "@/components/PostList";
import { TLink } from "@/components/Transition";
import { longDate, type Post } from "@/lib/posts";

const d = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as React.CSSProperties;

export function BlogView() {
  const { posts } = useContent();
  return (
    <main className="page" data-kind="blog">
      <section className="wrap d-hero">
        <div className="d-copy">
          <p className="mono rise">
            <TLink href="/">Home</TLink> / Blog
          </p>
          <h1 className="rise" style={d(80)}>
            <span className="name">Blog</span>
          </h1>
          <p className="lede rise" style={d(160)}>
            Notes on code, maths, music and whatever else I am working out.
          </p>
        </div>
      </section>
      <section className="wrap section">
        <PostList posts={posts} />
      </section>
      <Footer />
    </main>
  );
}

// One post. The body is a list of blocks: paragraphs, "## headings" and ``` code blocks.
export function PostView({ post }: { post: Post }) {
  const { posts } = useContent();
  const index = posts.findIndex((x) => x.slug === post.slug);
  const newer = posts[index - 1];
  const older = posts[index + 1];
  return (
    <main className="page" data-kind="blog">
      <article className="wrap post">
        <p className="mono rise">
          <TLink href="/">Home</TLink> / <TLink href="/blog">Blog</TLink> / {post.title}
        </p>
        <h1 className="rise" style={d(80)}>
          <span className="name">{post.title}</span>
        </h1>
        <p className="post-meta mono rise" style={d(140)}>
          <span>{longDate(post.date)}</span>
          {post.tags.map((t) => (
            <span key={t} className="post-tag">
              {t}
            </span>
          ))}
          {post.sample && <span className="post-tag sample">sample post</span>}
        </p>
        <div className="post-body glass rise" style={d(220)}>
          {post.body.map((block, n) =>
            block.startsWith("## ") ? (
              <h2 key={n}>{block.slice(3)}</h2>
            ) : block.startsWith("```") ? (
              <pre key={n}>
                <code>{block.replace(/^```\n?|\n?```$/g, "")}</code>
              </pre>
            ) : (
              <p key={n}>{block}</p>
            ),
          )}
        </div>
        <nav className="post-nav" aria-label="More posts">
          {older ? (
            <TLink href={`/blog/${older.slug}`} className="btn btn-glass glass">
              ← {older.title}
            </TLink>
          ) : (
            <span />
          )}
          {newer ? (
            <TLink href={`/blog/${newer.slug}`} className="btn btn-glass glass">
              {newer.title} →
            </TLink>
          ) : (
            <TLink href="/blog" className="btn btn-glass glass">
              All posts
            </TLink>
          )}
        </nav>
      </article>
      <Footer />
    </main>
  );
}
