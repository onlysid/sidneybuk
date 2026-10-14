import type { Slug } from "./site";

export type Piece = {
  title: string;
  // One line on what it is. Leave empty for a piece that is not ready to show.
  note: string;
  // Gives the piece its own page at /work/<slug>. Leave out for placeholders.
  slug?: string;
  // Optional link out (the live site, a repo, a recording, a video).
  href?: string;
  // Optional short labels: what it is built with, or where it runs.
  tags?: string[];
  year?: string;
  // For the piece's own page: paragraphs of text, and a short list of facts down the side.
  body?: string[];
  facts?: [string, string][];
  // Pictures that show what it is.
  images?: { src: string; alt: string; phone?: boolean; pad?: boolean; badge?: string }[];
  // A drawn illustration used as the cover when there are no pictures yet.
  art?: "wheel" | "pitch";
  // For this site's own entry: show the real animated logo instead of a picture of it.
  live?: "logo";
};

// Replace these placeholders with real work.
export const portfolio: Record<Slug, Piece[]> = {
  code: [
    {
      slug: "wheeltune",
      title: "WheelTune",
      note: "A platform for keeping roulette wheels true. Put a phone on the rotor and it shows how to level the wheel, then keeps a record of every test for the whole team.",
      href: "https://wheeltune.app",
      tags: ["Web", "iOS", "Android", "Flutter"],
      art: "wheel",
      year: "2026",
      images: [
        { src: "wheeltuneSite", alt: "The WheelTune website: A new standard for wheel performance" },
        { src: "wheeltuneDashboard", alt: "The web dashboard: wheels, fleet health, testing activity and a log of every test" },
        { src: "wheeltuneHow", alt: "How it works: put the phone on the rotor, adjust the wheel's feet, keep a record of every test" },
        { src: "wheeltunePhone1", alt: "WheelTune on iPhone, App Store screenshot 1 of 7", phone: true },
        { src: "wheeltunePhone2", alt: "WheelTune on iPhone, App Store screenshot 2 of 7", phone: true },
        { src: "wheeltunePhone3", alt: "WheelTune on iPhone, App Store screenshot 3 of 7", phone: true },
        { src: "wheeltunePhone4", alt: "WheelTune on iPhone, App Store screenshot 4 of 7", phone: true },
        { src: "wheeltunePhone5", alt: "WheelTune on iPhone, App Store screenshot 5 of 7", phone: true },
        { src: "wheeltunePhone6", alt: "WheelTune on iPhone, App Store screenshot 6 of 7", phone: true },
        { src: "wheeltunePhone7", alt: "WheelTune on iPhone, App Store screenshot 7 of 7", phone: true },
        { src: "wheeltunePad1", alt: "WheelTune on iPad", pad: true },
        { src: "wheeltunePad2", alt: "WheelTune on iPad, a second screen", pad: true },
      ],
      body: [
        "A roulette wheel that is very slightly off level, or wearing unevenly, stops being random. WheelTune is a maintenance platform for the casino teams who look after them: level, test and monitor every wheel on the floor from one place.",
        "Levelling takes three steps. Put the phone on the rotor: the app uses the sensors already in the phone, so there is no bubble level, no gauge and nothing to calibrate. It then shows how much to adjust each of the wheel's feet to bring it perfectly level. Every test and adjustment is logged against that wheel.",
        "The web dashboard is where a team sees the whole fleet: which wheels have never been tested or are overdue, testing activity over time, and the history of every wheel. More tests are on the way, including a material check for the pockets, a bearing test and a ball-track test, along with a health score for each wheel.",
      ],
      facts: [
        ["Platforms", "Web, iOS and Android"],
        ["Built with", "Flutter for the apps"],
        ["Status", "Version 0.9, on the App Store since June 2026"],
        ["Pricing", "Tokens bought in bundles; no subscription"],
        ["Published by", "Aspect Innovations"],
      ],
    },
    {
      slug: "sidneyb-uk",
      title: "sidneyb.uk",
      note: "This site. A playground as much as a portfolio: a logo that is redrawn every frame, a menu that behaves like liquid, and something to play with on every page.",
      tags: ["Next.js", "React", "TypeScript", "Canvas", "Web Audio"],
      year: "2026",
      live: "logo",
      body: [
        "The brief I gave myself was to move my work from an old domain to a new one and to make the result feel alive. Every page has something to do on it: a terminal, a padel match, a tuning lab that lets you hear why pianos are slightly out of tune, a camera pointed at landscapes that do not exist.",
        "There is no animation library. The logo is three strings redrawn on a canvas sixty times a second, and each mode is a different function for how those strings move. The menu is one piece of glass whose size is measured from its contents and sprung between states. Sound is synthesised in the browser.",
        "The whole thing is Next.js and TypeScript, with the content kept in a handful of plain files so that adding a book, a post or a piece of music is a one-line change.",
      ],
      facts: [
        ["Built with", "Next.js, React, TypeScript"],
        ["Motion", "CSS, canvas and Web Audio; no libraries"],
        ["Pages", "Eight subjects, a blog and a terminal"],
      ],
    },
    {
      slug: "passage-2-pro",
      title: "Passage 2 Pro",
      note: "The website for P2P Academy, a professional football academy: a React site with motion and a little 3D.",
      href: "https://p2pfootball.co.uk",
      tags: ["React", "Vite", "Tailwind", "Three.js", "Framer Motion"],
      year: "2025",
      art: "pitch",
      images: [{ src: "p2pPitch", alt: "A floodlit football pitch from above, with the P2P Academy crest", badge: "p2pLogo" }],
      body: [
        "The website for Passage 2 Pro, a professional football academy. It is a single-page React site built with Vite and styled with Tailwind.",
        "Motion is done with Framer Motion, and there is a small Three.js scene in the page. Enquiries are sent from the browser with EmailJS, and the site is deployed on Vercel.",
      ],
      facts: [
        ["Built with", "React, Vite, Tailwind"],
        ["Motion and 3D", "Framer Motion, Three.js"],
        ["Hosted on", "Vercel"],
      ],
    },
  ],
  maths: [],
  music: [], // pieces and daily doses have their own lists: lib/repertoire.ts and lib/doses.ts
  film: [], // film and photo projects have their own list: lib/film.ts
  learning: [], // subjects and notes have their own lists: lib/learning.ts
  reading: [],
  travel: [], // the travel log has its own list: lib/travel.ts
  sport: [],
};

// Every piece that has its own page, with the subject it belongs to.
export const work = (Object.entries(portfolio) as [Slug, Piece[]][]).flatMap(([subject, pieces]) => pieces.filter((p) => p.slug).map((p) => ({ ...p, slug: p.slug as string, subject })));
export const workBySlug = (slug: string) => work.find((p) => p.slug === slug);
