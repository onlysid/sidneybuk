// The changelog: what has been added to the site, fixed or made better, newest first.
export type Change = { slug: string; date: string; title: string; tag: "New" | "Better" | "Fixed"; note?: string };

export const TAGS: Change["tag"][] = ["New", "Better", "Fixed"];
export const seedChanges: Change[] = [
  { slug: "away", date: "2026-10-12", tag: "New", title: "Away, and back", note: "The home, contact and travel pages say when I am away, with a note of my own." },
  { slug: "audio-dock", date: "2026-10-11", tag: "New", title: "Controls for whatever is playing", note: "Start a score or a recording and the bar at the bottom becomes its pause, position and close." },
  { slug: "cycling", date: "2026-10-11", tag: "New", title: "A cycling page", note: "Every ride, what they add up to, and the year month by month." },
  { slug: "score-editor", date: "2026-10-11", tag: "New", title: "Scores can be written on the site", note: "Tap the notes in on a piano and the page engraves and plays them." },
  { slug: "installable", date: "2026-10-10", tag: "New", title: "The site can be installed as an app", note: "Pages you have visited still open without a connection." },
  { slug: "card-groups", date: "2026-10-10", tag: "New", title: "Flashcards in groups", note: "A topic's deck can be split into sets to learn one at a time." },
  { slug: "live", date: "2026-10-10", tag: "Better", title: "Pages keep themselves up to date", note: "What is playing and the sport numbers refresh without reloading." },
  { slug: "clean-start", date: "2026-10-10", tag: "Better", title: "Nothing made up", note: "Sections with nothing in them yet say so, with no sample content standing in." },
  { slug: "score-hands", date: "2026-10-10", tag: "Better", title: "A hand switched off is greyed out on the score", note: "So what is left to play stands out." },
  { slug: "score-stops", date: "2026-10-10", tag: "Fixed", title: "The score stops sounding the moment it is paused", note: "And the bar stays on the note at every zoom." },
  { slug: "log-by-week", date: "2026-10-10", tag: "Better", title: "The run log by week, month, quarter or year", note: "With each stretch compared to the one before it." },
  { slug: "gym-charts", date: "2026-10-10", tag: "Better", title: "A chart for every gym machine", note: "Over all time, a year, three months or a month." },
  { slug: "flip-cards", date: "2026-10-10", tag: "Better", title: "Cards that turn over", note: "And they are only read aloud where the device has a voice for the language." },
  { slug: "changelog", date: "2026-10-10", tag: "New", title: "This changelog", note: "A plain list of what changes on the site, and when." },
  { slug: "piece-grades", date: "2026-10-10", tag: "New", title: "Grades and sheet music sources on pieces", note: "Each piece can say how hard it is and where my copy of the score came from." },
  { slug: "shelves-stay-put", date: "2026-10-10", tag: "Fixed", title: "Bookshelves stay where they are when a book is taken out" },
  { slug: "footer-bottom", date: "2026-10-10", tag: "Fixed", title: "The footer sits at the bottom of short pages" },
  { slug: "training", date: "2026-10-09", tag: "New", title: "Training write-ups", note: "Runs, gym sessions and padel arrive from Strava; I add the kind of run, the weights or the score." },
  { slug: "run-log", date: "2026-10-09", tag: "New", title: "The run log", note: "Three years of runs, a quarter at a time, with the averages and best times." },
  { slug: "gym-padel", date: "2026-10-09", tag: "New", title: "Gym and padel pages", note: "Each machine's weight as a staircase, and the padel record match by match." },
  { slug: "vo2-padel-tools", date: "2026-10-09", tag: "New", title: "VO₂ max for your age, and Lithuanian padel levels", note: "Two more tools on the sport tools page." },
  { slug: "notebook", date: "2026-10-09", tag: "Better", title: "Learning is now a notebook", note: "Subjects, topics and notes, with maths, diagrams, cards, scores and interactive pieces inside them." },
  { slug: "globe-speed", date: "2026-10-09", tag: "Better", title: "The travel globe is quick when zoomed in" },
  { slug: "iphone-sound", date: "2026-10-09", tag: "Fixed", title: "Sound on iPhones with the silent switch on" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthOf = (date: string) => `${MONTHS[Number(date.slice(5, 7)) - 1] ?? ""} ${date.slice(0, 4)}`;
// Entries gathered by day, newest day first, and days gathered by month.
export function byMonth(changes: Change[]) {
  const sorted = [...changes].sort((a, b) => b.date.localeCompare(a.date));
  const months: { month: string; days: { date: string; list: Change[] }[] }[] = [];
  for (const c of sorted) {
    const month = monthOf(c.date);
    let m = months[months.length - 1];
    if (!m || m.month !== month) months.push((m = { month, days: [] }));
    let day = m.days[m.days.length - 1];
    if (!day || day.date !== c.date) m.days.push((day = { date: c.date, list: [] }));
    day.list.push(c);
  }
  return months;
}
