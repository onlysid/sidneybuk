// Who the site belongs to: the things that never change from day to day.
export const site = {
  name: "Sidney Brown",
  domain: "sidneyb.uk",
  url: "https://sidneyb.uk",
  role: "Software engineer",
  // The pipe-separated line from onlysid.com, typed one at a time in the hero.
  interests: ["Coding", "Music", "Videography", "Video Editing", "Problem Solving", "Mathematics"],
  intro:
    "I'm a software engineer with an enthusiasm for mathematics and problem solving. I am currently working on this website/portfolio so feel free to watch this space!",
  email: "hello@sidneyb.uk",
  // Still served from the old domain. Copy the PDF into /public/files and point this at "/files/…" when you migrate.
  resumeUrl: "https://www.onlysid.com/files/sidney-brown-cv-dark.pdf",
  // From my CV. Shown on the Maths and physics page.
  degree: { title: "BSc Mathematics and Physics", place: "University College London", year: "2020" },
} as const;

export const disciplines = [
  { slug: "code", title: "Code", short: "Software engineering, with an enthusiasm for mathematics and problem solving.", toyTitle: "Try the terminal", toyHint: "Type help, or play for a game." },
  { slug: "music", title: "Music", short: "Piano, guitar and voice. What I play, what I am learning, and what I am writing.", toyTitle: "", toyHint: "" },
  { slug: "film", title: "Film and photo", short: "Trips, photographs and videos, and how the pictures get made.", toyTitle: "", toyHint: "" },
  { slug: "learning", title: "Learning", short: "My notebook. Writing something up is how I learn it, so each page here is a thing I have worked out and set down: languages, music theory, computer science, philosophy, maths and physics.", toyTitle: "", toyHint: "" },
  { slug: "reading", title: "Reading", short: "Books I am reading, and what I made of the ones I have finished.", toyTitle: "The library", toyHint: "Tap a spine to pull the book out. Search, or regroup the shelves." },
  { slug: "travel", title: "Travel", short: "A log of the places I have lived in and been to, and a list of the ones I have not.", toyTitle: "", toyHint: "" },
  { slug: "sport", title: "Sport and fitness", short: "Running, padel, tennis and keeping fit.", toyTitle: "Two quick tests", toyHint: "How fast are your hands, and how fast could you run?" },
  // Last on purpose: it is where I started, not what I do most days.
  { slug: "maths", title: "Maths and physics", short: "What I studied at university, and still a real interest. I do less of it now, but I work it into my everyday work wherever I can.", toyTitle: "Three proofs and an experiment", toyHint: "Step through a proof by contradiction, by construction and by induction. Then fire some electrons." },
] as const;

export type Slug = (typeof disciplines)[number]["slug"];
export const bySlug = (slug: string) => disciplines.find((d) => d.slug === slug);
