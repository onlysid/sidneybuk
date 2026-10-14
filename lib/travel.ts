import type { Frame } from "./film";

// My travel log.
export type Entry = {
  slug: string;
  title: string;
  date: string; // YYYY-MM or YYYY-MM-DD
  summary: string;
  // The write-up. Paragraphs, and "## headings".
  body: string[];
  // Pictures: real photographs are files in /public/travel ({ src: "/travel/vilnius-01.jpg" }); until there are some, a { seed } draws a stand-in…
  frames: Frame[];
  // Set on the placeholder entries below so the page marks them as samples.
  sample?: boolean;
};
export type Place = {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  // What it is to me.
  kind: "Home" | "Lived here" | "Visited";
  // A few words for lists.
  tagline: string;
  // A short description, shown on the place's card and on the globe before anyone opens the full page.
  blurb: string;
  // When, in whatever words fit ("1996 to 2017", "Summer 2024").
  when?: string;
  // About the place and me. Paragraphs.
  about: string[];
  cover: Frame;
  entries: Entry[];
};

// The five places below are the ones you named, with what you told me about each.
export const seedPlaces: Place[] = [
  {
    slug: "cambridge",
    name: "Cambridge",
    country: "England",
    lat: 52.2053,
    lon: 0.1218,
    kind: "Home",
    tagline: "My home town.",
    blurb: "A small university city on the River Cam, in the flat east of England: old colleges, bicycles everywhere, and open fen country in every direction. Home, and the place everywhere else gets compared with.",
    about: ["Where I am from. Sample text: say what Cambridge is to you, what you miss, and what you make a point of doing every time you go back."],
    cover: { seed: 1203 },
    entries: [
      {
        slug: "going-home",
        title: "Going home",
        date: "2025-12",
        summary: "A week back where I started.",
        body: ["Sample entry. An entry is one visit, or one thing worth writing down: what you did, who you saw, what had changed. Add as many to a place as you like; the newest shows first."],
        frames: [{ seed: 1203, caption: "Sample picture", shape: "wide" }, { seed: 1217 }, { seed: 1229 }],
        sample: true,
      },
    ],
  },
  {
    slug: "london",
    name: "London",
    country: "England",
    lat: 51.5246,
    lon: -0.134,
    kind: "Lived here",
    tagline: "Where I went to university.",
    blurb: "Three years in Bloomsbury, studying mathematics and physics at UCL. Big enough that you only ever learn your own corner of it, and mine was the few streets between the university, the British Museum and King's Cross.",
    when: "Until 2020",
    about: ["I studied mathematics and physics at University College London, in Bloomsbury, and graduated in 2020. Sample text: say what those years were like and which parts of the city are yours."],
    cover: { seed: 2311 },
    entries: [
      {
        slug: "ucl",
        title: "The UCL years",
        date: "2020-06",
        summary: "Three years in Bloomsbury.",
        body: ["Sample entry. Where you lived, where you studied, where you went when you should have been studying."],
        frames: [{ seed: 2311, caption: "Sample picture", shape: "wide" }, { seed: 2324 }, { seed: 2338 }],
        sample: true,
      },
      {
        slug: "back-for-a-weekend",
        title: "Back for a weekend",
        date: "2024-09",
        summary: "The same streets, a few years on.",
        body: ["Sample entry. A second entry for the same place, to show how a place's log builds up over time."],
        frames: [{ seed: 2351 }, { seed: 2367 }],
        sample: true,
      },
    ],
  },
  {
    slug: "vilnius",
    name: "Vilnius",
    country: "Lithuania",
    lat: 54.6872,
    lon: 25.2797,
    kind: "Home",
    tagline: "My other home.",
    blurb: "The capital of Lithuania: a baroque old town of courtyards and church towers, with forest starting almost at the edge of the city. My second home, and the reason I am learning the language.",
    about: ["My second home, and the reason I am learning Lithuanian. Sample text: say how Vilnius became home and what a normal day there looks like."],
    cover: { seed: 3407 },
    entries: [
      {
        slug: "the-old-town",
        title: "The old town, again",
        date: "2025-07",
        summary: "Summer in the city.",
        body: ["Sample entry. Replace with a real one."],
        frames: [{ seed: 3407, caption: "Sample picture", shape: "wide" }, { seed: 3419 }, { seed: 3433 }, { seed: 3446 }],
        sample: true,
      },
    ],
  },
  {
    slug: "copenhagen",
    name: "Copenhagen",
    country: "Denmark",
    lat: 55.6761,
    lon: 12.5683,
    kind: "Visited",
    tagline: "A holiday.",
    blurb: "Denmark's capital, built on the water and best seen from a bicycle. A long weekend of harbours, cinnamon buns and very good design.",
    about: ["Sample text: when you went, who with, and the one thing you would tell someone to do there."],
    cover: { seed: 4519 },
    entries: [
      {
        slug: "a-long-weekend",
        title: "A long weekend",
        date: "2024-05",
        summary: "Bicycles, harbours and very good bread.",
        body: ["Sample entry. Replace with a real one."],
        frames: [{ seed: 4519, caption: "Sample picture", shape: "wide" }, { seed: 4532 }, { seed: 4547 }],
        sample: true,
      },
    ],
  },
  {
    slug: "california",
    name: "California",
    country: "United States",
    // The middle of the state: move this to the town you are actually in.
    lat: 36.7783,
    lon: -119.4179,
    kind: "Lived here",
    tagline: "Where I am now.",
    blurb: "Where I am living now. Wide roads, dry hills and more sky than England has, with the Pacific on one side and desert on the other.",
    when: "Now",
    about: ["Where I am living at the moment. Sample text: say what brought you here, and how it compares with home."],
    cover: { seed: 5621 },
    entries: [
      {
        slug: "first-weeks",
        title: "The first few weeks",
        date: "2026-09",
        summary: "Everything is very far apart and very bright.",
        body: ["Sample entry. Replace with a real one."],
        frames: [{ seed: 5621, caption: "Sample picture", shape: "wide" }, { seed: 5634 }, { seed: 5648 }],
        sample: true,
      },
    ],
  },
];

// Places I would like to go. SAMPLES: these four are placeholders. Replace them with the real list.
export type Wish = { name: string; country: string; lat: number; lon: number; why: string };
export const seedWishlist: Wish[] = [
  { name: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503, why: "" },
  { name: "Reykjavík", country: "Iceland", lat: 64.1466, lon: -21.9426, why: "Sample reason." },
  { name: "Lisbon", country: "Portugal", lat: 38.7223, lon: -9.1393, why: "Sample reason." },
  { name: "Patagonia", country: "Argentina and Chile", lat: -49.3, lon: -73.0, why: "Sample reason." },
];

export const entryDate = (date: string) => new Intl.DateTimeFormat("en-GB", date.length > 7 ? { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" } : { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date((date.length > 7 ? date : date + "-01") + "T00:00:00Z"));
// Find places by any words in the name, country, what it is to me, or anything written in its entries.
export function searchPlaces(places: Place[], query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return places;
  return places.filter((p) => {
    const hay = [p.name, p.country, p.kind, p.tagline, p.blurb, p.when ?? "", ...p.about, ...p.entries.flatMap((e) => [e.title, e.summary, e.date.slice(0, 4), ...e.body])].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
