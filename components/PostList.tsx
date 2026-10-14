import { Empty } from "./Empty";
import { longDate, type Post } from "@/lib/posts";
import { Tilt } from "./Tilt";
import { TLink } from "./Transition";

// Posts as a list of rows: date, title, summary, tags.
export function PostList({ posts }: { posts: Post[] }) {
  if (!posts.length) return <Empty title="Nothing written yet">Posts will show here as I write them.</Empty>;
  return (
    <div className="posts">
      {posts.map((post, n) => (
        <Tilt key={post.slug} className="rise" max={4}>
          <TLink href={`/blog/${post.slug}`} className="post-row glass" style={{ ["--delay" as string]: `${200 + n * 80}ms` }}>
          <span className="post-date mono">{longDate(post.date)}</span>
          <span className="post-main">
            <b>{post.title}</b>
            <span>{post.summary}</span>
            <span className="post-tags">
              {post.tags.map((t, k) => (
                <i key={t} className="post-tag" style={{ ["--k" as string]: k }}>
                  {t}
                </i>
              ))}
              {post.sample && <i className="post-tag sample">sample post</i>}
            </span>
          </span>
          <span className="post-go" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
          </TLink>
        </Tilt>
      ))}
    </div>
  );
}
