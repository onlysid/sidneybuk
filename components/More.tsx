"use client";

import { useState } from "react";
import type { Post } from "@/lib/posts";
import { PostList } from "./PostList";

// A long list shown a part at a time, with a button that brings in the next part where you are (no new page).
export function useMore<T>(list: T[], step: number) {
  const [count, setCount] = useState(step);
  const left = Math.max(0, list.length - count);
  const more = left > 0 && (
    <button type="button" className="btn btn-glass glass small sp-more" onClick={() => setCount(count + step)}>
      Show more ({left.toLocaleString("en-GB")} to go)
    </button>
  );
  return [list.slice(0, count), more] as const;
}

// Blog posts, a few at a time.
export function MorePosts({ posts, step }: { posts: Post[]; step: number }) {
  const [list, more] = useMore(posts, step);
  return (
    <>
      <PostList posts={list} />
      {more}
    </>
  );
}
