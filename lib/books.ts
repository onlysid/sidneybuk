// The library. Each book gets its own page at /reading/<slug>.
export type Book = {
  slug: string;
  title: string;
  author: string;
  status: "reading" | "read" | "next";
  genre: string;
  // Out of 5, once you have finished it. Leave out until then.
  rating?: number;
  // One or two sentences: what you would say if someone asked "any good?". Shown on the shelf.
  review: string;
  // Everything else you have to say, as long as you like. A list of blocks: paragraphs and "## headings".
  thoughts?: string[];
  // What was taken from it, as short points in the reader's own words.
  takeaways?: string[];
  started?: string; // YYYY-MM
  finished?: string; // YYYY-MM
  // How far through, 0 to 100, while you are reading it.
  progress?: number;
  pages?: number;
  published?: number;
  // The cover.
  cover?: string;
  isbn?: string;
  // Marks the placeholder entries below so the page labels them as samples.
  sample?: boolean;
};

// How many books you want to finish this year. The page shows how far along you are.
export const seedYearlyGoal = 12;

const SAMPLE = "Sample review. Say in a sentence or two what the book was and whether it was worth the time.";
const LONG = [
  "Sample write-up. This is the long version, for when a book deserves more than a line: what it argues, where it is at its best, where it lost you, and what you would say to someone about to start it.",
  "## What stayed with me",
  "A paragraph on the idea, scene or chapter that you are still thinking about a month later.",
  "## Who it is for",
  "And a paragraph on who you would hand it to.",
];

// SAMPLE SHELF.
export const seedBooks: Book[] = [
  { slug: "godel-escher-bach", title: "Gödel, Escher, Bach", author: "Douglas Hofstadter", status: "reading", genre: "Philosophy", started: "2026-09", progress: 35, pages: 777, published: 1979, isbn: "9780465026562", review: "", thoughts: ["Sample note. Notes in progress go here while you are still reading: what it is doing so far, and whether you think you will finish it."], sample: true },
  { slug: "surely-youre-joking", title: "Surely You're Joking, Mr. Feynman!", author: "Richard Feynman", status: "read", genre: "Biography", rating: 5, finished: "2026-08", pages: 350, published: 1985, isbn: "9780393316049", review: SAMPLE, thoughts: LONG, takeaways: ["Sample point: one thing you took from it.", "Sample point: and another."], sample: true },
  { slug: "meditations", title: "Meditations", author: "Marcus Aurelius", status: "read", genre: "Philosophy", rating: 4, finished: "2026-05", pages: 254, isbn: "9780140449334", review: SAMPLE, thoughts: LONG, sample: true },
  { slug: "the-pragmatic-programmer", title: "The Pragmatic Programmer", author: "David Thomas and Andrew Hunt", status: "read", genre: "Programming", rating: 4, finished: "2026-02", pages: 352, published: 1999, isbn: "9780135957059", review: SAMPLE, thoughts: LONG, sample: true },
  { slug: "a-brief-history-of-time", title: "A Brief History of Time", author: "Stephen Hawking", status: "read", genre: "Science", rating: 4, finished: "2025-11", pages: 212, published: 1988, isbn: "9780553380163", review: SAMPLE, sample: true },
  { slug: "the-code-book", title: "The Code Book", author: "Simon Singh", status: "read", genre: "Mathematics", rating: 5, finished: "2025-08", pages: 411, published: 1999, isbn: "9780385495325", review: SAMPLE, thoughts: LONG, sample: true },
  { slug: "fermats-last-theorem", title: "Fermat's Last Theorem", author: "Simon Singh", status: "read", genre: "Mathematics", rating: 4, finished: "2025-06", pages: 340, published: 1997, review: SAMPLE, sample: true },
  { slug: "musicophilia", title: "Musicophilia", author: "Oliver Sacks", status: "read", genre: "Music", rating: 3, finished: "2025-03", pages: 381, published: 2007, review: SAMPLE, sample: true },
  { slug: "dune", title: "Dune", author: "Frank Herbert", status: "read", genre: "Fiction", rating: 5, finished: "2025-01", pages: 612, published: 1965, isbn: "9780441172719", review: SAMPLE, thoughts: LONG, sample: true },
  { slug: "hitchhikers-guide", title: "The Hitchhiker's Guide to the Galaxy", author: "Douglas Adams", status: "read", genre: "Fiction", rating: 5, finished: "2024-10", pages: 193, published: 1979, isbn: "9780345391803", review: SAMPLE, sample: true },
  { slug: "clean-code", title: "Clean Code", author: "Robert C. Martin", status: "read", genre: "Programming", rating: 3, finished: "2024-07", pages: 431, published: 2008, isbn: "9780132350884", review: SAMPLE, sample: true },
  { slug: "sapiens", title: "Sapiens", author: "Yuval Noah Harari", status: "read", genre: "History", rating: 4, finished: "2024-04", pages: 443, published: 2011, isbn: "9780062316097", review: SAMPLE, sample: true },
  { slug: "thinking-fast-and-slow", title: "Thinking, Fast and Slow", author: "Daniel Kahneman", status: "read", genre: "Psychology", rating: 4, finished: "2024-02", pages: 499, published: 2011, isbn: "9780374533557", review: SAMPLE, sample: true },
  { slug: "zen-and-the-art", title: "Zen and the Art of Motorcycle Maintenance", author: "Robert M. Pirsig", status: "next", genre: "Philosophy", pages: 418, published: 1974, isbn: "9780060589462", review: "", sample: true },
  { slug: "the-feynman-lectures", title: "The Feynman Lectures on Physics", author: "Richard Feynman", status: "next", genre: "Science", pages: 1552, published: 1964, isbn: "9780465023820", review: "", sample: true },
];

export const monthYear = (ym: string) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(ym + "-01T00:00:00Z"));
// Find books by any words in the title, author or genre. Used by the page's search box and by the terminal.
export function searchBooks(books: Book[], query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return books;
  return books.filter((b) => {
    const hay = `${b.title} ${b.author} ${b.genre} ${b.status === "next" ? "up next" : b.status} ${b.finished?.slice(0, 4) ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
