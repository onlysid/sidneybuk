// The shape of everything the site shows that can be edited in the admin area, and its starting values.
import { seedBooks, seedYearlyGoal, type Book } from "./books";
import { seedDoses, type Dose } from "./doses";
import { seedProjects, type Project } from "./film";
import { seedNotes, seedSubjects, seedTopics, type Note, type Subject, type Topic } from "./learning";
import { seedPosts, type Post } from "./posts";
import { seedRepertoire, type Piece } from "./repertoire";
import { seedChanges, type Change } from "./changes";
import { seedLifts, type Lift } from "./gym";
import { seedGoals, seedPbs, type Goal, type Pb } from "./sport";
import { seedPlaces, seedWishlist, type Place, type Wish } from "./travel";

// Settings anyone may see. (API keys are kept separately, encrypted, and never leave the server.)
export type Settings = {
  // Where I am right now.
  location: { name: string; lat: number; lon: number; timeZone: string; message?: string; manual?: boolean; away?: boolean; until?: string } | null;
  // What the bar at the bottom shows after "Now working on". Leave the name empty to show the most recently pushed public repository.
  workingOn: { name: string; href: string };
  // Profiles elsewhere. An empty one hides its link.
  social: { youtube: string; instagram: string; spotify: string; appleMusic: string; strava: string };
  // GitHub username (drives the Code page) and YouTube channel ID (lists the latest uploads; starts "UC…").
  integrations: { github: string; youtubeChannelId: string };
  // How many books I want to finish this year.
  yearlyGoal: number;
  // Sport.
  sport: { showMaps: boolean; tiles: boolean; trim: number; showWeight: boolean; showNotes: boolean; gymPlan: string };
};

export type Content = {
  settings: Settings;
  posts: Post[];
  books: Book[];
  repertoire: Piece[];
  doses: Dose[];
  projects: Project[];
  subjects: Subject[];
  topics: Topic[];
  notes: Note[];
  places: Place[];
  wishlist: Wish[];
  pbs: Pb[];
  goals: Goal[];
  lifts: Lift[];
  changes: Change[];
};

// The settings a new database starts with. Nothing here is made up: no place until I set one.
export const seedSettings: Settings = {
  location: null,
  workingOn: { name: "sidneyb.uk", href: "/work/sidneyb-uk" },
  // NOTE: the YouTube and Instagram addresses are guesses from the GitHub name. Check them.
  social: { youtube: "https://www.youtube.com/@onlysid", instagram: "https://www.instagram.com/onlysid", spotify: "", appleMusic: "", strava: "" },
  integrations: { github: "onlysid", youtubeChannelId: "" },
  yearlyGoal: seedYearlyGoal,
  sport: { showMaps: true, tiles: true, trim: 500, showWeight: false, showNotes: true, gymPlan: "To exhaustion · 8 reps · 3 sets" },
};

// What a new, empty database is filled with, and what the site shows with no database at all.
export const seed: Content = {
  settings: seedSettings,
  posts: [],
  books: seedBooks,
  repertoire: seedRepertoire,
  doses: [],
  projects: [],
  subjects: seedSubjects,
  topics: seedTopics,
  notes: seedNotes,
  places: seedPlaces,
  wishlist: seedWishlist.slice(0, 1),
  pbs: [],
  goals: [],
  lifts: seedLifts,
  changes: seedChanges,
};

// The made-up extras, used only by the single-file preview (preview/), which has no server behind it.
export const sample: Content = {
  ...seed,
  settings: { ...seedSettings, location: { name: "California", lat: 36.7783, lon: -119.4179, timeZone: "America/Los_Angeles" } },
  posts: seedPosts,
  doses: seedDoses,
  projects: seedProjects,
  wishlist: seedWishlist,
  pbs: seedPbs,
  goals: seedGoals,
};
