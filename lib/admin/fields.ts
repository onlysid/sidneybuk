import type { Kind } from "./kinds";

// What the form for each kind of content looks like.
type Extra = { more?: boolean };
export type Field = Extra & (
  | { key: string; label: string; type: "text" | "long" | "number" | "date" | "month" | "when" | "check" | "tags" | "lines" | "blocks" | "verses" | "pairs" | "scores"; help?: string; placeholder?: string; wide?: boolean }
  | { key: string; label: string; type: "select"; options: string[]; help?: string; wide?: boolean }
  | { key: string; label: string; type: "file"; accept: "image" | "audio" | "score" | "any"; help?: string; wide?: boolean }
  | { key: string; label: string; type: "list"; one: string; titleKey: string; fields: Field[]; help?: string; wide?: boolean }
  // Writing, in Markdown, with buttons for the things a note can hold and a preview.
  | { key: string; label: string; type: "markdown"; help?: string; wide?: boolean; rows?: number }
  // One of the things of another kind (a subject, a topic), chosen from a list. `within` narrows topics to the chosen subject.
  | { key: string; label: string; type: "ref"; of: Kind; within?: string; help?: string; wide?: boolean; none?: string }
);

export type KindForm = {
  kind: Kind;
  group: string;
  // What the things are called, many and one.
  many: string;
  one: string;
  // Which field is the name shown in lists.
  titleKey: "title" | "name";
  // A line under the name in lists.
  summary: (data: Record<string, unknown>) => string;
  // Where it appears on the site.
  url: (slug: string, data: Record<string, unknown>) => string;
  // What a new one starts with.
  blank: Record<string, unknown>;
  fields: Field[];
};

const BLOCKS = "One paragraph per block; leave a blank line between them. Start a line with ## for a heading.";
const today = () => new Date().toISOString().slice(0, 10);
const frames = (label = "Pictures"): Field => ({
  key: "frames",
  label,
  type: "list",
  one: "picture",
  titleKey: "caption",
  wide: true,
  fields: [
    { key: "src", label: "Photograph", type: "file", accept: "image" },
    { key: "caption", label: "Caption", type: "text" },
    { key: "shape", label: "Shape in the grid", type: "select", options: ["", "wide", "tall"] },
  ],
});
const resources: Field = {
  key: "resources",
  label: "What I am using",
  type: "list",
  one: "resource",
  titleKey: "title",
  wide: true,
  fields: [
    { key: "title", label: "Title", type: "text" },
    { key: "by", label: "By", type: "text" },
    { key: "kind", label: "Kind", type: "select", options: ["Book", "Course", "App", "Podcast", "Lectures"] },
    { key: "status", label: "Status", type: "select", options: ["Using now", "Finished", "Up next"] },
    { key: "href", label: "Link", type: "text", placeholder: "https://…" },
  ],
};
const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));

export const FORMS: KindForm[] = [
  {
    kind: "post",
    group: "Writing",
    many: "Blog posts",
    one: "post",
    titleKey: "title",
    summary: (d) => `${s(d.date)} · ${s(d.summary)}`,
    url: (slug) => `/blog/${slug}`,
    blank: { title: "", date: today(), summary: "", tags: [], body: [] },
    fields: [
      { key: "title", label: "Title", type: "text", wide: true },
      { key: "date", label: "Date", type: "date" },
      { key: "tags", label: "Tags", type: "tags", help: "Separate with commas: code, maths, sport" },
      { key: "summary", label: "Summary", type: "long", help: "One or two sentences, shown in lists.", wide: true },
      { key: "body", label: "The post", type: "blocks", help: `${BLOCKS} Wrap code in lines of \`\`\`.`, wide: true },
    ],
  },
  {
    kind: "book",
    group: "Reading",
    many: "Books",
    one: "book",
    titleKey: "title",
    summary: (d) => `${s(d.author)} · ${s(d.status)}${d.rating ? ` · ${s(d.rating)}/5` : ""}`,
    url: (slug) => `/reading/${slug}`,
    blank: { title: "", author: "", status: "next", genre: "", review: "" },
    fields: [
      { key: "title", label: "Title", type: "text", wide: true },
      { key: "author", label: "Author", type: "text" },
      { key: "genre", label: "Genre", type: "text", help: "Books are grouped by this." },
      { key: "status", label: "Status", type: "select", options: ["reading", "read", "next"] },
      { key: "rating", label: "Rating, out of 5", type: "number" },
      { key: "started", label: "Started", type: "month" },
      { key: "finished", label: "Finished", type: "month" },
      { key: "progress", label: "How far through, %", type: "number", help: "While you are reading it." },
      { key: "pages", label: "Pages", type: "number" },
      { key: "published", label: "First published (year)", type: "number" },
      { key: "isbn", label: "ISBN-13", type: "text", help: "Fetches the published cover from Open Library." },
      { key: "cover", label: "Or your own cover picture", type: "file", accept: "image" },
      { key: "review", label: "In a sentence or two", type: "long", wide: true },
      { key: "thoughts", label: "Everything else you have to say", type: "blocks", help: BLOCKS, wide: true },
      { key: "takeaways", label: "What I took from it", type: "lines", help: "One point per line.", wide: true },
    ],
  },
  {
    kind: "piece",
    group: "Music",
    many: "Pieces",
    one: "piece",
    titleKey: "title",
    summary: (d) => `${s(d.composer)} · ${s(d.stage)}`,
    url: (slug) => `/music/pieces/${slug}`,
    blank: { title: "", composer: "", instruments: ["piano"], stage: "Learning", proficiency: 10, note: "", about: [], tempo: 90, recordings: [] },
    fields: [
      { key: "title", label: "Title", type: "text", wide: true },
      { key: "fullTitle", label: "Full title", type: "text", wide: true },
      { key: "composer", label: "Composer", type: "text" },
      { key: "composerDates", label: "Composer's dates", type: "text", placeholder: "1685–1750" },
      { key: "catalogue", label: "Catalogue number", type: "text", placeholder: "BWV 846" },
      { key: "written", label: "Written", type: "text" },
      { key: "key", label: "Key", type: "text" },
      { key: "grade", label: "Grade", type: "text", placeholder: "ABRSM Grade 6", help: "How hard it is, on whichever scale you use: an exam board's grade, a Henle level, or your own words." },
      { key: "instruments", label: "Instruments", type: "tags", help: "piano, guitar, voice" },
      { key: "stage", label: "Where I am with it", type: "select", options: ["Learning", "Comfortable", "Performance ready"] },
      { key: "proficiency", label: "How well I know it, 0 to 100", type: "number" },
      { key: "started", label: "Learning since", type: "text" },
      { key: "tempo", label: "Tempo for the digital performance (crotchets a minute)", type: "number" },
      { key: "note", label: "One line for the card", type: "long", wide: true },
      { key: "about", label: "About the piece", type: "blocks", help: BLOCKS, wide: true },
      { key: "mine", label: "Playing it", type: "blocks", help: BLOCKS, wide: true },
      { key: "score", label: "The score (MusicXML)", type: "file", accept: "score", help: "Exported from MuseScore, Sibelius, Dorico or Finale. The page draws it and plays it from this one file." },
      { key: "pdf", label: "Printable score (PDF)", type: "file", accept: "any" },
      {
        key: "sources",
        label: "Where the sheet music came from",
        type: "list",
        one: "source",
        titleKey: "name",
        wide: true,
        help: "The edition, book or website your copy is from. Give an address and it becomes a link.",
        fields: [
          { key: "name", label: "Edition, book or site", type: "text", placeholder: "Henle Urtext, IMSLP, MuseScore" },
          { key: "href", label: "Address", type: "text", placeholder: "https://…" },
          { key: "note", label: "A note", type: "text", placeholder: "Fingering by András Schiff" },
        ],
      },
      { key: "listen.spotify", label: "A recording on Spotify", type: "text", placeholder: "https://open.spotify.com/track/…" },
      { key: "listen.appleMusic", label: "A recording on Apple Music", type: "text", placeholder: "https://music.apple.com/…" },
      {
        key: "recordings",
        label: "My recordings",
        type: "list",
        one: "recording",
        titleKey: "label",
        wide: true,
        fields: [
          { key: "label", label: "Label", type: "text" },
          { key: "date", label: "Date", type: "date" },
          { key: "src", label: "Audio file", type: "file", accept: "audio" },
          { key: "note", label: "Note", type: "text" },
        ],
      },
    ],
  },
  {
    kind: "dose",
    group: "Music",
    many: "Daily doses",
    one: "dose",
    titleKey: "title",
    summary: (d) => `${s(d.date)} · ${s(d.kind)} · ${s(d.note)}`,
    url: (slug) => `/music/doses/${slug}`,
    blank: { title: "", date: today(), kind: "Idea", instruments: [], note: "", body: [] },
    fields: [
      { key: "title", label: "Title", type: "text", wide: true },
      { key: "date", label: "Date", type: "date" },
      { key: "kind", label: "Kind", type: "select", options: ["Original", "Cover", "Idea", "Practice"] },
      { key: "instruments", label: "Instruments", type: "tags" },
      { key: "audio", label: "The clip", type: "file", accept: "audio" },
      { key: "note", label: "One line for the list", type: "long", wide: true },
      { key: "body", label: "What it is, and where it is going", type: "blocks", help: BLOCKS, wide: true },
      { key: "lyrics", label: "Lyrics", type: "verses", help: "One line per line; a blank line between verses.", wide: true },
      {
        key: "downloads",
        label: "Downloads",
        type: "list",
        one: "download",
        titleKey: "label",
        wide: true,
        fields: [
          { key: "label", label: "Label", type: "text", placeholder: "Audio (MP3)" },
          { key: "file", label: "File", type: "file", accept: "any" },
          { key: "name", label: "Name it downloads as", type: "text", placeholder: "my-song.mp3" },
        ],
      },
    ],
  },
  {
    kind: "project",
    group: "Film and photo",
    many: "Projects",
    one: "project",
    titleKey: "title",
    summary: (d) => `${s(d.kind)} · ${s(d.date)} · ${s(d.note)}`,
    url: (slug) => `/film/projects/${slug}`,
    blank: { title: "", kind: "Photos", date: today(), note: "", body: [], cover: {}, frames: [] },
    fields: [
      { key: "title", label: "Title", type: "text", wide: true },
      { key: "kind", label: "Kind", type: "select", options: ["Trip", "Photos", "Video"] },
      { key: "date", label: "Date", type: "date" },
      { key: "place", label: "Place", type: "text" },
      { key: "youtube", label: "YouTube video ID", type: "text", help: "For a video: the part after v= in its address." },
      { key: "cover.src", label: "Cover picture", type: "file", accept: "image" },
      { key: "note", label: "One line for the card", type: "long", wide: true },
      { key: "body", label: "The write-up", type: "blocks", help: BLOCKS, wide: true },
      { key: "facts", label: "Facts", type: "pairs", help: "One per line, as Label: value. For example Camera: Fujifilm X-T5", wide: true },
      frames("Frames"),
    ],
  },
  {
    kind: "place",
    group: "Travel",
    many: "Places",
    one: "place",
    titleKey: "name",
    summary: (d) => `${s(d.country)} · ${s(d.kind)} · ${Array.isArray(d.entries) ? d.entries.length : 0} entries`,
    url: (slug) => `/travel/${slug}`,
    blank: { name: "", country: "", lat: 0, lon: 0, kind: "Visited", tagline: "", blurb: "", about: [], cover: {}, entries: [] },
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "country", label: "Country", type: "text" },
      { key: "lat", label: "Latitude", type: "number", help: "North is positive. Right-click a spot in a maps app to copy it." },
      { key: "lon", label: "Longitude", type: "number", help: "East is positive." },
      { key: "kind", label: "What it is to me", type: "select", options: ["Home", "Lived here", "Visited"] },
      { key: "when", label: "When", type: "text", help: "Any words: 2017 to 2020, Summer 2024. Write Now for where you are." },
      { key: "tagline", label: "A few words", type: "text", wide: true },
      { key: "blurb", label: "Short description", type: "long", help: "Shown on the card and on the globe, before anyone opens the page.", wide: true },
      { key: "about", label: "About the place and me", type: "blocks", help: BLOCKS, wide: true },
      { key: "cover.src", label: "Cover picture", type: "file", accept: "image" },
      {
        key: "entries",
        label: "Log entries",
        type: "list",
        one: "entry",
        titleKey: "title",
        wide: true,
        fields: [
          { key: "title", label: "Title", type: "text", wide: true },
          { key: "date", label: "Date", type: "when", help: "A day, or just the month." },
          { key: "summary", label: "Summary", type: "text", wide: true },
          { key: "body", label: "The entry", type: "blocks", help: BLOCKS, wide: true },
          frames(),
        ],
      },
    ],
  },
  {
    kind: "wish",
    group: "Travel",
    many: "Places I want to go",
    one: "place",
    titleKey: "name",
    summary: (d) => `${s(d.country)} · ${s(d.why)}`,
    url: () => "/travel",
    blank: { name: "", country: "", lat: 0, lon: 0, why: "" },
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "country", label: "Country", type: "text" },
      { key: "lat", label: "Latitude", type: "number" },
      { key: "lon", label: "Longitude", type: "number" },
      { key: "why", label: "Why", type: "long", wide: true },
    ],
  },
  {
    kind: "subject",
    group: "Notebook",
    many: "Subjects",
    one: "subject",
    titleKey: "title",
    summary: (d) => s(d.now),
    url: (slug) => `/learning/${slug}`,
    blank: { title: "", short: "", now: "", about: "" },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "now", label: "What I am on right now", type: "text", wide: true },
      { key: "short", label: "One line for the card", type: "long", wide: true },
      { key: "about", label: "About it", type: "markdown", rows: 8, wide: true },
      {
        key: "links",
        label: "Elsewhere on this site",
        type: "list",
        one: "link",
        titleKey: "label",
        wide: true,
        fields: [
          { key: "label", label: "Label", type: "text" },
          { key: "href", label: "Address", type: "text", placeholder: "/music/fun" },
        ],
      },
    ],
  },
  {
    kind: "topic",
    group: "Notebook",
    many: "Topics",
    one: "topic",
    titleKey: "title",
    summary: (d) => `${s(d.subject)}${d.level ? ` · ${s(d.level)}` : ""} · ${Array.isArray(d.cards) ? d.cards.length : 0} cards`,
    url: (slug, d) => `/learning/${s(d.subject)}/${slug}`,
    blank: { title: "", subject: "", short: "", about: "", resources: [], cards: [] },
    fields: [
      { key: "title", label: "Title", type: "text", placeholder: "Lithuanian, Group theory, Harmony" },
      { key: "subject", label: "Subject", type: "ref", of: "subject", help: "Which part of the notebook it belongs to." },
      { key: "short", label: "One line for the card", type: "text", wide: true },
      { key: "about", label: "About it", type: "markdown", rows: 8, wide: true },
      { key: "level", label: "Level", type: "text", placeholder: "A1, beginner" },
      { key: "since", label: "Since", type: "text" },
      { key: "voice", label: "Voice code", type: "text", placeholder: "lt-LT", help: "For a language: lt-LT, fr-FR. A Hear it button appears on devices that have a voice for that language (iPhones have none for Lithuanian)." },
      resources,
    ],
  },
  {
    kind: "note",
    group: "Notebook",
    many: "Notes",
    one: "note",
    titleKey: "title",
    summary: (d) => `${s(d.date)} · ${s(d.subject)}${d.topic ? ` / ${s(d.topic)}` : ""}`,
    url: (slug, d) => `/learning/${s(d.subject)}/${slug}`,
    blank: { title: "", subject: "", topic: "", date: today(), summary: "", tags: [], md: "" },
    fields: [
      { key: "title", label: "Title", type: "text", wide: true },
      { key: "subject", label: "Subject", type: "ref", of: "subject" },
      { key: "topic", label: "Topic", type: "ref", of: "topic", within: "subject", none: "No topic" },
      { key: "md", label: "The note", type: "markdown", rows: 22, wide: true },
      { key: "summary", label: "Summary", type: "long", help: "One line, shown in lists.", wide: true },
      { key: "date", label: "Date", type: "date" },
      { key: "tags", label: "Tags", type: "tags" },
    ],
  },
  {
    kind: "pb",
    group: "Sport",
    many: "Personal bests",
    one: "personal best",
    titleKey: "title",
    summary: (d) => `${s(d.result)} · ${s(d.sport)} · ${s(d.date)}`,
    url: () => "/sport",
    blank: { title: "", sport: "Running", result: "", date: today(), note: "" },
    fields: [
      { key: "title", label: "What", type: "text", placeholder: "5 km, Half marathon, Deadlift, Padel level" },
      { key: "result", label: "Result", type: "text", placeholder: "19:42, 140 kg, 4.1", help: "Shown large, exactly as you type it." },
      { key: "sport", label: "Sport", type: "text", placeholder: "Running" },
      { key: "date", label: "Date", type: "date" },
      { key: "where", label: "Where", type: "text", placeholder: "Cambridge parkrun" },
      { key: "activity", label: "Strava activity number", type: "text", help: "Optional. The number at the end of the activity's address; the card then links to its page here." },
      { key: "note", label: "A line about it", type: "long", wide: true },
    ],
  },
  {
    kind: "goal",
    group: "Sport",
    many: "Goals",
    one: "goal",
    titleKey: "title",
    summary: (d) => `${s(d.measure)}${d.target ? ` · ${s(d.target)}` : ""}${d.done ? " · done" : ""}`,
    url: () => "/sport",
    blank: { title: "", measure: "By hand", progress: 0, note: "" },
    fields: [
      { key: "title", label: "The goal", type: "text", wide: true, placeholder: "Run 1,000 km this year" },
      { key: "measure", label: "How it is measured", type: "select", options: ["By hand", "Distance this year (km)", "Activities this year", "Hours this year"], help: "Anything but By hand is counted from Strava by itself." },
      { key: "sport", label: "Strava sport to count", type: "text", placeholder: "Run", help: "Strava's own name: Run, Ride, Swim, Hike, WeightTraining, Padel… Leave empty to count every sport." },
      { key: "target", label: "Target number", type: "number", help: "For the counted kinds: the kilometres, activities or hours to reach." },
      { key: "progress", label: "How far along, %", type: "number", help: "For By hand." },
      { key: "due", label: "By when", type: "date" },
      { key: "done", label: "Done", type: "check" },
      { key: "note", label: "A line about it", type: "long", wide: true },
    ],
  },
  {
    kind: "lift",
    group: "Sport",
    many: "Gym machines",
    one: "machine",
    titleKey: "title",
    summary: (d) => `${Array.isArray(d.log) && d.log.length ? `${s((d.log[d.log.length - 1] as Record<string, unknown>).value)} ${s(d.unit)}`.trim() : "Not done yet"} · ${Array.isArray(d.log) ? d.log.length : 0} entries`,
    url: () => "/sport/gym",
    blank: { title: "", unit: "kg", step: 2.5, start: "", note: "", log: [] },
    fields: [
      { key: "title", label: "Machine or exercise", type: "text", placeholder: "Low row" },
      { key: "unit", label: "Unit", type: "text", placeholder: "kg", help: "Leave empty for something written out, like 5 min · 1.25 km." },
      { key: "step", label: "Each press of + or − changes it by", type: "number" },
      { key: "start", label: "Where the weight starts, the first time", type: "text", help: "Only what the buttons begin at before anything has been logged." },
      { key: "note", label: "A line about it", type: "long", wide: true },
      {
        key: "log",
        label: "Every time",
        type: "list",
        one: "entry",
        titleKey: "value",
        fields: [
          { key: "date", label: "Date", type: "date" },
          { key: "value", label: "Weight (or what was done)", type: "text" },
          { key: "note", label: "Note", type: "text" },
        ],
      },
    ],
  },
  {
    kind: "change",
    group: "Writing",
    many: "Changelog",
    one: "change",
    titleKey: "title",
    summary: (d) => `${s(d.tag)} · ${s(d.date)}`,
    url: () => "/changelog",
    blank: { title: "", date: today(), tag: "New", note: "" },
    fields: [
      { key: "title", label: "What changed", type: "text", wide: true, placeholder: "The run log" },
      { key: "tag", label: "Kind", type: "select", options: ["New", "Better", "Fixed"] },
      { key: "date", label: "Date", type: "date" },
      { key: "note", label: "A sentence more, if it needs one", type: "long", wide: true },
    ],
  },
];
// What each form shows straight away. Everything else is under "More".
const FIRST: Record<Kind, string[]> = {
  post: ["title", "date", "tags", "summary", "body"],
  book: ["title", "author", "genre", "status", "rating", "isbn", "review", "thoughts"],
  piece: ["title", "composer", "grade", "stage", "proficiency", "note", "score", "sources", "recordings"],
  dose: ["title", "date", "kind", "audio", "note", "body"],
  project: ["title", "kind", "date", "cover.src", "note", "body", "frames"],
  place: ["name", "country", "lat", "lon", "kind", "blurb", "cover.src", "entries"],
  wish: ["name", "country", "lat", "lon", "why"],
  subject: ["title", "now", "short", "about"],
  topic: ["title", "subject", "short", "about"],
  note: ["title", "subject", "topic", "md", "summary"],
  pb: ["title", "result", "sport", "date"],
  goal: ["title", "measure", "sport", "target", "progress"],
  lift: ["title", "unit", "step", "note", "log"],
  change: ["title", "tag", "date", "note"],
};
for (const form of FORMS) for (const f of form.fields) f.more = !FIRST[form.kind].includes(f.key);
export const formFor = (kind: string) => FORMS.find((f) => f.kind === kind);
