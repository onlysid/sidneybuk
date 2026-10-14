export type Post = {
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  summary: string;
  tags: string[];
  // The post itself, one block per entry: a paragraph, "## A heading", or a code block wrapped in ``` lines.
  body: string[];
  // Marks the placeholder posts below so the site labels them as samples.
  sample?: boolean;
};

// SAMPLE POSTS.
export const seedPosts: Post[] = [
  {
    slug: "how-the-logo-moves",
    title: "How the logo moves",
    date: "2026-10-07",
    summary: "The mark on the home page is three strings redrawn sixty times a second. Here is how.",
    tags: ["code", "maths"],
    sample: true,
    body: [
      "The logo on the home page is not a video or a set of frames. It is drawn fresh on a canvas every frame from one line: the curve the S follows.",
      "## One line, three strings",
      "That curve is stored as a list of points. For each point the code works out the normal, the direction at right angles to the curve. A string is the curve pushed sideways along its normals and given a width that is thin at the ends and full in the middle.",
      "```\noffset = (string - 1) * gap + wobble(u, t)\nedge   = point + normal * (offset ± width(u) / 2)\n```",
      "Everything the logo does comes from changing that one wobble function. For music it is a standing wave that dies away. For maths it is three sine waves a third of a turn apart. For code the string is cut into dashes that scroll.",
      "## Cutting, not drawing",
      "The strings are not drawn on top of the tile. They are cut out of it, so whatever is behind the page shows through. The tile's outline is four corner radii that spring towards a new set of values in each mode.",
    ],
  },
  {
    slug: "hello",
    title: "Hello, sidneyb.uk",
    date: "2026-10-01",
    summary: "A new name and a new home for the things I make.",
    tags: ["site"],
    sample: true,
    body: [
      "This is a sample post. It is here to show what a post looks like: a title, a date, a few tags and some paragraphs.",
      "## Writing a post",
      "Posts live in one file, lib/posts.ts. Each one is an entry with a slug, a title, a date, a summary and a body. The body is a list of blocks: plain paragraphs, headings that start with two hashes, and code blocks.",
      "Add a new entry at the top of the list, rebuild, and it appears here, on the home page and in the menu.",
    ],
  },
];

export const longDate = (date: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(date + "T00:00:00Z"));
