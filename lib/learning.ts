// The notebook. Three kinds of thing, each edited in the admin area:
//
//   a subject   Languages, Mathematics, Music theory…                          /learning/<subject>
//   a topic     a part of a subject with its own page: Lithuanian, Group theory  /learning/<subject>/<topic>
//   a note      one page of writing, in a subject and usually in a topic        /learning/<subject>/<note>
//
// Notes and "about" texts are written in Markdown, with a few extras (see components/Markdown.tsx):
// LaTeX between $ signs, diagrams, flashcards, callouts, and scores, audio and video dropped in like pictures.
// A topic can carry a deck of flashcards; cards written inside its notes join the same deck.

export type Resource = { title: string; by?: string; kind: "Book" | "Course" | "App" | "Podcast" | "Lectures"; href?: string; status: "Using now" | "Finished" | "Up next" };
export type Subject = {
  slug: string;
  title: string;
  // One line for the card.
  short: string;
  // What I am on at the moment.
  now: string;
  // What it is to me, and why. Markdown.
  about: string;
  // Places on this site that go with it.
  links?: { label: string; href: string }[];
};
// A card: the front, the back, and optionally the group it belongs to within its topic ("Greetings", "Food").
export type Card = readonly [front: string, back: string, group?: string];
export type Topic = {
  slug: string;
  subject: string;
  title: string;
  short: string;
  // Markdown.
  about: string;
  // Free words: "A1, beginner", "Second pass", "Just starting".
  level?: string;
  since?: string;
  // For a language: the code the browser uses to read the cards aloud ("lt-LT"), where it has a voice for it.
  voice?: string;
  resources: Resource[];
  cards: Card[];
  sample?: boolean;
};
export type Note = { slug: string; subject: string; topic?: string; title: string; date: string; summary: string; tags: string[]; md: string; sample?: boolean };

// SAMPLE CONTENT throughout this file.
export const seedSubjects: Subject[] = [
  { slug: "languages", title: "Languages", short: "Lithuanian from nothing, French from school.", now: "Lithuanian: the genitive case. French: listening without subtitles.", about: "I am learning two languages at once, on purpose, because they fail in different ways. French I half-know from school and have to un-learn; Lithuanian I started from nothing and it has seven grammatical cases.\n\nEach has its own part of the notebook: my notes in order, and a deck of cards you are welcome to learn with me." },
  { slug: "music-theory", title: "Music theory", short: "Harmony, voice leading, and why the things that sound good sound good.", now: "Secondary dominants, and hearing them rather than spotting them on the page.", about: "I can play more than I can explain. This is me closing that gap: learning the names for things my hands already do, and then the things they do not.", links: [{ label: "Play with temperaments and time signatures", href: "/music/fun" }, { label: "The pieces I am learning", href: "/music" }] },
  { slug: "computer-science", title: "Computer science", short: "The theory under the job: algorithms, data, and how machines really work.", now: "How databases keep their promises: write-ahead logs and B-trees.", about: "I write software for a living, which is not the same as knowing computer science. This is the part I did not study formally: how the tools I use every day are built, underneath.", links: [{ label: "What I build with", href: "/code" }] },
  { slug: "philosophy", title: "Philosophy", short: "Mostly of mind, of maths and of science. Reading, slowly.", now: "What it means for a mathematical object to exist.", about: "Where the other subjects run out of answers. I read philosophy the way I would like to read everything: slowly, with a pencil.", links: [{ label: "What I am reading", href: "/reading" }] },
  { slug: "maths", title: "Mathematics", short: "Picking pure maths back up where the degree left off.", now: "Group theory: cosets and Lagrange's theorem.", about: "My degree was half mathematics. Since then I have mostly used it rather than studied it, and I miss studying it. So: abstract algebra again, slowly, with the proofs done by hand.", links: [{ label: "Three proofs, step by step", href: "/maths" }] },
  { slug: "physics", title: "Physics", short: "Quantum mechanics again, properly this time.", now: "Working the hydrogen atom through from Schrödinger's equation.", about: "The other half of the degree. Quantum mechanics was the part I loved, and the part I would like to understand better than I needed to for the exam.", links: [{ label: "The double-slit experiment", href: "/maths" }, { label: "How a lens works", href: "/film/fun" }] },
];

export const seedTopics: Topic[] = [
  {
    slug: "lithuanian",
    subject: "languages",
    title: "Lithuanian",
    short: "From nothing, twenty minutes a day.",
    level: "A1, beginner",
    since: "2026",
    voice: "lt-LT",
    about: "Sample: say why this language. One of the oldest living Indo-European languages, and almost nobody outside Lithuania learns it.\n\n**How I am going about it**\n\n- Twenty minutes a day, every day, before anything else\n- A textbook for grammar, audio for the sounds\n- One real conversation a week",
    resources: [{ title: "Colloquial Lithuanian", by: "Meilutė Ramonienė and Ian Press", kind: "Book", status: "Using now" }, { title: "Pimsleur Lithuanian", kind: "Course", status: "Using now" }],
    cards: [
      ["Labas", "Hello"],
      ["Ačiū", "Thank you"],
      ["Prašau", "Please / You're welcome"],
      ["Taip", "Yes"],
      ["Ne", "No"],
      ["Labas rytas", "Good morning"],
      ["Labanakt", "Good night"],
      ["Atsiprašau", "Sorry / Excuse me"],
      ["Viso gero", "Goodbye"],
      ["Į sveikatą", "Cheers"],
      ["Kaip sekasi?", "How are you?"],
      ["Vanduo", "Water"],
      ["Draugas", "Friend"],
      ["Muzika", "Music"],
      ["Knyga", "Book"],
      ["Meilė", "Love"],
    ],
    sample: true,
  },
  {
    slug: "french",
    subject: "languages",
    title: "French",
    short: "The one I was taught and never learned.",
    level: "A2, getting by",
    since: "At school, and again in 2026",
    voice: "fr-FR",
    about: "Sample: say why this language. The one I was taught and never learned; it seemed a waste to leave it there.\n\n- Listening first: a podcast episode a day\n- Duolingo for the daily habit\n- Reading something short and real every week",
    resources: [{ title: "Duolingo", kind: "App", href: "https://www.duolingo.com", status: "Using now" }, { title: "InnerFrench", kind: "Podcast", href: "https://innerfrench.com", status: "Using now" }],
    cards: [
      ["Bonjour", "Hello"],
      ["Merci", "Thank you"],
      ["S'il vous plaît", "Please"],
      ["Oui", "Yes"],
      ["Non", "No"],
      ["Bonne nuit", "Good night"],
      ["Pardon", "Sorry / Excuse me"],
      ["Au revoir", "Goodbye"],
      ["Santé", "Cheers"],
      ["Comment ça va ?", "How are you?"],
      ["L'eau", "Water"],
      ["Un ami", "A friend"],
      ["La musique", "Music"],
      ["Un livre", "A book"],
      ["L'amour", "Love"],
      ["Bonne journée", "Have a good day"],
    ],
    sample: true,
  },
  { slug: "group-theory", subject: "maths", title: "Group theory", short: "Symmetry, written down.", level: "Second pass", since: "2026", about: "Abstract algebra from the beginning again, with every proof done by hand. Following *Visual Group Theory* and checking myself against a proper textbook.", resources: [{ title: "Visual Group Theory", by: "Nathan Carter", kind: "Book", status: "Using now" }], cards: [["What is a group?", "A set with an operation that is associative, has an identity, and in which every element has an inverse."], ["Lagrange's theorem", "The size of a subgroup divides the size of the group: $|H|$ divides $|G|$."], ["What is a coset?", "A subgroup shifted by one element: $gH = \\{gh : h \\in H\\}$."], ["What is a normal subgroup?", "One whose left and right cosets agree: $gN = Ng$ for every $g$."]], sample: true },
  { slug: "linear-algebra", subject: "maths", title: "Linear algebra", short: "Vectors, maps between them, and what stays the same.", level: "Revising", about: "The part of the degree I use most without noticing. Going back through it without determinants first, the Axler way.", resources: [{ title: "Linear Algebra Done Right", by: "Sheldon Axler", kind: "Book", status: "Up next" }], cards: [], sample: true },
  { slug: "harmony", subject: "music-theory", title: "Harmony", short: "Chords, and where they want to go.", level: "Working through", about: "Diatonic harmony first, then the chromatic chords that borrow from other keys.", resources: [{ title: "Tonal Harmony", by: "Stefan Kostka and Dorothy Payne", kind: "Book", status: "Using now" }], cards: [["V7 of V in C major", "D7: D, F♯, A, C"], ["What makes a chord a dominant?", "A major triad with a minor seventh on top, a fifth above where it wants to go."]], sample: true },
  { slug: "quantum-mechanics", subject: "physics", title: "Quantum mechanics", short: "The part I loved.", level: "Second pass", about: "Shankar from the start, doing the problems this time.", resources: [{ title: "Principles of Quantum Mechanics", by: "R. Shankar", kind: "Book", status: "Using now" }, { title: "The Feynman Lectures on Physics", by: "Richard Feynman", kind: "Lectures", href: "https://www.feynmanlectures.caltech.edu", status: "Using now" }], cards: [], sample: true },
  { slug: "data-structures", subject: "computer-science", title: "Data structures", short: "What the everyday tools are made of.", about: "Opening up the things I use every day and looking at how they work.", resources: [{ title: "Designing Data-Intensive Applications", by: "Martin Kleppmann", kind: "Book", status: "Using now" }], cards: [], sample: true },
];

export const seedNotes: Note[] = [
  {
    slug: "the-genitive-does-everything",
    subject: "languages",
    topic: "lithuanian",
    title: "The genitive does everything",
    date: "2026-10-04",
    summary: "The case that means 'of', and also 'not', and also 'some'.",
    tags: ["Grammar", "Cases"],
    md: `Sample note. Three weeks in, and the genitive case has turned out to be the one that matters most. In English it is just "of". In Lithuanian it turns up everywhere.

## Possession

The owner goes first, in the genitive: *draugo knyga*, a friend's book. No word for "of" at all; the ending does the work.

## Saying no

This is the one that caught me out. A verb that takes the accusative when it is positive takes the genitive when it is negative.

| | Lithuanian | English | Case |
|---|---|---|---|
| Yes | Turiu **draugą**. | I have a friend. | accusative |
| No | Neturiu **draugo**. | I do not have a friend. | genitive |

> [!tip]
> If the sentence has *ne-* on the verb, check every object: it has probably moved to the genitive.

## Words from this note

\`\`\`cards
draugo knyga :: a friend's book
Neturiu draugo :: I do not have a friend
daug vandens :: a lot of water
\`\`\`

## What I got wrong this week

I kept using the nominative after numbers. From ten upwards, the thing being counted goes in the genitive plural. More on that next time.`,
    sample: true,
  },
  {
    slug: "seven-cases",
    subject: "languages",
    topic: "lithuanian",
    title: "Seven cases, and how I am not panicking",
    date: "2026-09-20",
    summary: "Every noun has seven forms. Here is the plan for learning them without a table.",
    tags: ["Grammar", "Cases"],
    md: `Sample note. Lithuanian nouns change their ending depending on the job they are doing in the sentence. There are seven jobs: nominative, genitive, dative, accusative, instrumental, locative and vocative.

I am not learning the table. I am learning one whole phrase for each case, with a word I already know, and letting the pattern arrive on its own.

- **Draugas.** A friend (who is doing something).
- **Draugo.** Of a friend.
- **Draugui.** To a friend.
- **Draugą.** A friend (who something is done to).

Three more to go. The vocative is the fun one: it is the form you use to call someone.`,
    sample: true,
  },
  {
    slug: "why-and-how",
    subject: "languages",
    topic: "lithuanian",
    title: "Why Lithuanian, and how I am going about it",
    date: "2026-09-06",
    summary: "Starting a language from nothing, as an adult, with twenty minutes a day.",
    tags: ["Method"],
    md: `Sample note. This is the first page of the Lithuanian notebook: what I did, what worked, and what I got wrong.

## The method

Twenty minutes every day beats two hours on a Sunday. Sounds first, because the alphabet has nine letters English does not (ą, č, ę, ė, į, š, ų, ū, ž) and the stress can fall anywhere. Then phrases, whole. Grammar only once I have phrases to hang it on.

## The first words

Labas. Ačiū. Prašau. Taip. Ne. That is hello, thank you, please, yes and no, and it gets you surprisingly far.`,
    sample: true,
  },
  {
    slug: "starting-again-from-school-french",
    subject: "languages",
    topic: "french",
    title: "Starting again from school French",
    date: "2026-09-12",
    summary: "I can conjugate être and cannot order a coffee. Fixing that.",
    tags: ["Method"],
    md: `Sample note. Five years of school French left me able to recite verb tables and unable to follow a single spoken sentence. So this time the order is reversed: listening first, a lot of it, and grammar only when I trip over something.

The rule I have set: one podcast episode a day, in French made for learners, no transcript the first time through.`,
    sample: true,
  },
  {
    slug: "cosets",
    subject: "maths",
    topic: "group-theory",
    title: "Cosets, or how a subgroup tiles its group",
    date: "2026-09-25",
    summary: "The idea that makes Lagrange's theorem obvious.",
    tags: ["Subgroups", "Proofs"],
    md: `Sample note, to show what a maths page can hold. Take a subgroup $H$ of a group $G$, and shift every element of $H$ by some $g \\in G$. That shifted copy is a **coset**:

$$gH = \\{\\, gh : h \\in H \\,\\}$$

> [!definition]
> A **left coset** of $H$ in $G$ is a set $gH$ for some $g \\in G$. The number of distinct cosets is the **index**, written $[G:H]$.

## Two facts

1. Every coset is the same size as $H$, because $h \\mapsto gh$ is a bijection.
2. Two cosets are either identical or do not overlap at all.

> [!theorem] Lagrange
> If $H$ is a subgroup of a finite group $G$, then $|H|$ divides $|G|$, and
> $$|G| = [G:H]\\,|H|.$$

> [!proof]
> The cosets of $H$ cover $G$ (each $g$ is in $gH$), they do not overlap, and each has $|H|$ elements. So $G$ is cut into $[G:H]$ pieces of size $|H|$.

## How the ideas hang together

\`\`\`diagram
Subgroup H -> Cosets gH: shift by g
Cosets gH -> Same size as H
Cosets gH -> Disjoint or equal
Same size as H -> Lagrange
Disjoint or equal -> Lagrange
\`\`\`

## Check yourself

\`\`\`cards
How many cosets does a subgroup of order 4 have in a group of order 12? :: Three: $12 / 4$.
Can a group of order 15 have a subgroup of order 4? :: No. 4 does not divide 15.
\`\`\``,
    sample: true,
  },
  {
    slug: "what-a-group-is",
    subject: "maths",
    topic: "group-theory",
    title: "What a group is",
    date: "2026-09-14",
    summary: "Four rules, and why each one is there.",
    tags: ["Definitions"],
    md: `Sample note. A **group** is a set $G$ with an operation $\\cdot$ such that:

1. **Closure.** $a \\cdot b \\in G$ for all $a, b \\in G$.
2. **Associativity.** $(a \\cdot b) \\cdot c = a \\cdot (b \\cdot c)$.
3. **Identity.** There is an $e$ with $e \\cdot a = a \\cdot e = a$.
4. **Inverses.** Every $a$ has an $a^{-1}$ with $a \\cdot a^{-1} = e$.

The symmetries of a square, the integers under addition, and the ways of shuffling a deck are all groups. That one definition covers all three is the whole point.`,
    sample: true,
  },
  {
    slug: "why-the-circle-of-fifths-keeps-turning-up",
    subject: "music-theory",
    topic: "harmony",
    title: "Why the circle of fifths keeps turning up",
    date: "2026-09-28",
    summary: "It is not a diagram to memorise. It is what happens when you multiply by three halves.",
    tags: ["Tuning", "Keys"],
    md: `Sample note, to show a score inside a page. Go up a perfect fifth and the frequency is multiplied by $\\tfrac{3}{2}$. Do it twelve times and you are almost exactly seven octaves up:

$$\\left(\\tfrac{3}{2}\\right)^{12} \\approx 129.7 \\qquad 2^{7} = 128$$

That near miss is the whole of Western tuning. The circle closes only if you shave a little off each fifth, which is what equal temperament does.

It is also why neighbouring keys on the circle share all but one note, and so why moving round it sounds smooth. Bach walks round it in the first prelude of the *Well-Tempered Clavier*:

![Prelude in C major, J. S. Bach](/scores/bach-prelude-in-c.musicxml)

> [!note]
> Any MusicXML file dropped into a note becomes a score you can play, like this one.`,
    sample: true,
  },
  {
    slug: "hydrogen-by-hand",
    subject: "physics",
    topic: "quantum-mechanics",
    title: "The hydrogen atom, by hand",
    date: "2026-09-18",
    summary: "Where the quantum numbers n, l and m actually come from.",
    tags: ["Schrödinger equation"],
    md: `Sample note. In an undergraduate course the hydrogen atom arrives as a finished table of orbitals. I wanted to see the quantum numbers appear.

They come from separating Schrödinger's equation in spherical coordinates,

$$-\\frac{\\hbar^2}{2m}\\nabla^2\\psi - \\frac{e^2}{4\\pi\\varepsilon_0 r}\\,\\psi = E\\,\\psi, \\qquad \\psi(r,\\theta,\\phi) = R(r)\\,Y(\\theta,\\phi).$$

Each separation needs a constant, and each constant can only take certain values if the wavefunction is to stay finite and single-valued. Those allowed values are the quantum numbers, and the energies that fall out are

$$E_n = -\\frac{13.6\\ \\text{eV}}{n^2}.$$

Nothing is put in by hand except the Coulomb potential. The periodic table's structure is a consequence of asking for a wavefunction that does not blow up.

## What a wavefunction is for

All of this rests on the electron being described by a wave until it is looked at. The experiment that shows it most plainly:

\`\`\`demo
double-slit
\`\`\`

> [!note]
> Any of the site's interactive pieces can be put into a note by name, like this one.`,
    sample: true,
  },
  {
    slug: "what-a-hash-table-does",
    subject: "computer-science",
    topic: "data-structures",
    title: "What a hash table actually does",
    date: "2026-09-10",
    summary: "The data structure behind every object and dictionary, opened up.",
    tags: ["Hashing"],
    md: `Sample note. A hash table turns a key into a number, and uses the number as a position in an array. That is the whole trick, and it is why looking something up takes the same time whether there are ten entries or ten million.

\`\`\`js
const index = hash(key) % buckets.length;
\`\`\`

\`\`\`diagram
direction: right
key -> hash(key): run through a hash
hash(key) -> index: mod the table size
index -> bucket: look there
\`\`\`

The interesting part is what happens when two keys land in the same place, and what the table does when it gets full.`,
    sample: true,
  },
];

// ---- Finding things -----------------------------------------------------------------------------------------
const byDate = (a: Note, b: Note) => b.date.localeCompare(a.date);
// The notes of a subject, newest first; with a topic, only that topic's (pass "" for the ones in no topic).
export const notesIn = (notes: Note[], subject: string, topic?: string) => notes.filter((n) => n.subject === subject && (topic === undefined || (n.topic ?? "") === topic)).sort(byDate);
// What a note is made of besides words, for the small marks beside it in a list.
export function holds(md: string): string[] {
  const out: string[] = [];
  if (/\$\$[\s\S]+?\$\$|(^|[^\\$])\$[^\s$][^$\n]*\$/.test(md)) out.push("maths");
  if (/```diagram/.test(md)) out.push("diagram");
  if (/!\[[^\]]*\]\([^)]+\.(musicxml|mxl|xml)\)/i.test(md)) out.push("score");
  if (/!\[[^\]]*\]\([^)]+\.(mp3|m4a|wav|ogg|flac)\)/i.test(md)) out.push("audio");
  if (/!\[[^\]]*\]\([^)]*(youtu\.?be|\.(mp4|webm|mov)\))/i.test(md)) out.push("video");
  if (/```demo/.test(md)) out.push("interactive");
  const cards = cardsIn(md).length;
  if (cards) out.push(`${cards} ${cards === 1 ? "card" : "cards"}`);
  return out;
}
// Cards written inside a note, in ```cards blocks, one to a line as "front :: back".
export function cardsFrom(text: string, group = ""): Card[] {
  const out: Card[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const cut = [/\t+/, /\s*::\s*/, /\s+[-–—]\s+/, /\s*=\s*/, /\s*:\s+/, /\s*;\s*/].map((sep) => sep.exec(line)).find((m) => m && m.index > 0 && m.index + m[0].length < line.length);
    if (!cut) continue;
    const front = line.slice(0, cut.index).trim(), back = line.slice(cut.index + cut[0].length).trim();
    if (front && back) out.push(group ? [front, back, group] : [front, back]);
  }
  return out;
}
export function cardsIn(md: string): Card[] {
  const out: Card[] = [];
  for (const block of md.matchAll(/```cards\s*\n([\s\S]*?)```/g)) {
    // A line starting with # names the group for the cards under it.
    let group = "";
    for (const line of block[1].split("\n")) {
      if (/^\s*#/.test(line)) {
        group = line.replace(/^\s*#+\s*/, "").trim();
        continue;
      }
      const at = line.indexOf("::");
      if (at > 0 && line.slice(at + 2).trim()) out.push(group ? [line.slice(0, at).trim(), line.slice(at + 2).trim(), group] : [line.slice(0, at).trim(), line.slice(at + 2).trim()]);
    }
  }
  return out;
}
// A topic's whole deck: its own cards, then the ones written in its notes (oldest note first), without repeats.
export function deckFor(topic: Topic, notes: Note[]): Card[] {
  const seen = new Set<string>(), out: Card[] = [];
  for (const card of [...topic.cards, ...notesIn(notes, topic.subject, topic.slug).reverse().flatMap((n) => cardsIn(n.md))]) {
    if (seen.has(card[0])) continue;
    seen.add(card[0]);
    out.push(card);
  }
  return out;
}
// Every note that mentions all the words asked for, in its title, tags, summary or text.
export function searchNotes(notes: Note[], query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return notes.filter((n) => words.every((w) => `${n.title} ${n.tags.join(" ")} ${n.summary} ${n.topic ?? ""} ${n.md}`.toLowerCase().includes(w))).sort(byDate);
}
