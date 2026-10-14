import { createRoot } from "react-dom/client";
import "../app/globals.css";
import { Shell } from "@/components/Shell";
import { bySlug, type Slug } from "@/lib/site";
import { DisciplineView } from "@/views/DisciplineView";
import { BlogView, PostView } from "@/views/BlogView";
import { ContentProvider } from "@/components/Content";
import { sample as seed } from "@/lib/content";

import { useSyncExternalStore } from "react";
import { AdminApp } from "@/components/admin/AdminApp";
import { current, demoActivities, demoDetail, demoLog, demoPadel, demoRides, subscribe } from "./shims/admin-api";
import { ContactView } from "@/views/ContactView";
import { HomeView } from "@/views/HomeView";
import { ChangelogView } from "@/views/ChangelogView";
import { PrivacyView } from "@/views/PrivacyView";
import { Lost } from "@/components/Lost";
import { WorkView } from "@/views/WorkView";
import { workBySlug } from "@/lib/portfolio";
import { MusicFunView, PieceView, DoseView } from "@/views/MusicViews";
import { FilmFunView, ProjectView } from "@/views/FilmViews";
import { BookView } from "@/views/ReadingViews";
import { PlaceView } from "@/views/TravelViews";
import { NoteView, SubjectView, TopicView } from "@/views/LearningViews";
import { ActivitiesView, ActivityView, SportToolsView } from "@/views/SportViews";
import { GymView, PadelView, RideView, RunLogView } from "@/views/TrainingViews";
import { listActivities, summarise } from "@/lib/sport";
import { sampleActivities, sampleDetail, sampleHealth, sampleList } from "@/lib/sport-sample";
// @ts-ignore: embedded as text by the preview bundler
import bach from "../public/scores/bach-prelude-in-c.musicxml";
// @ts-ignore
import clementi from "../public/scores/clementi-sonatina-op36-no1.musicxml";
// @ts-ignore
import joplin from "../public/scores/joplin-the-entertainer.musicxml";
import { usePathname } from "./shims/navigation";
// @ts-ignore: written by preview/build.mjs just before bundling
import SOUNDS from "./.out/sounds.json";

const SCORES: Record<string, string> = { "/scores/bach-prelude-in-c.musicxml": bach, "/scores/clementi-sonatina-op36-no1.musicxml": clementi, "/scores/joplin-the-entertainer.musicxml": joplin };

// The preview has no database: its content lives in memory, starts as the starting content, and changes as the admin area (also in memory here) is used.
function Root() {
  const content = useSyncExternalStore(subscribe, current, current);
  return (
    <ContentProvider value={content}>
      <App content={content} />
      <TryErrors />
    </ContentProvider>
  );
}

// Preview only: a quick way to open the error pages, which have no links of their own.
function TryErrors() {
  const path = usePathname();
  const go = (window as unknown as { go: (href: string) => void }).go;
  return (
    <div className="pv-try" data-on={!path.startsWith("/admin")}>
      <span className="mono">Try</span>
      {[["/no-such-page", "404"], ["/locked", "403"], ["/broken", "500"]].map(([href, label]) => (
        <button key={href} type="button" onClick={() => go(href)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function App({ content }: { content: typeof seed }) {
  const slug = usePathname().replace(/^\//, "");
  const postBySlug = (slug: string) => content.posts.find((p) => p.slug === slug);
  const pieceBySlug = (slug: string) => content.repertoire.find((p) => p.slug === slug);
  const doseBySlug = (slug: string) => content.doses.find((p) => p.slug === slug);
  const projectBySlug = (slug: string) => content.projects.find((p) => p.slug === slug);
  const bookBySlug = (slug: string) => content.books.find((p) => p.slug === slug);
  const placeBySlug = (slug: string) => content.places.find((p) => p.slug === slug);
  const subjectBySlug = (slug: string) => content.subjects.find((p) => p.slug === slug);
  const noteBySlug = (subject: string, slug: string) => content.notes.find((n) => n.subject === subject && n.slug === slug);
  if (slug === "sport/tools") return <Shell><SportToolsView /></Shell>;
  if (slug === "changelog") return <Shell><ChangelogView /></Shell>;
  if (slug === "sport/log") return <Shell><RunLogView /></Shell>;
  if (slug === "sport/gym") return <Shell><GymView /></Shell>;
  if (slug === "sport/padel") return <Shell><PadelView /></Shell>;
  if (slug === "sport/cycling") return <Shell><RideView /></Shell>;
  if (slug === "sport/activities") return <Shell><ActivitiesView /></Shell>;
  if (slug.startsWith("sport/activities/") && demoDetail(slug.slice(17))) return <Shell><ActivityView key={slug} activity={demoDetail(slug.slice(17))!} /></Shell>;
  if (slug === "admin" || slug.startsWith("admin/")) return <Shell><AdminApp /></Shell>;
  if (slug.startsWith("reading/") && bookBySlug(slug.slice(8))) return <Shell><BookView key={slug} book={bookBySlug(slug.slice(8))!} /></Shell>;
  if (slug.startsWith("travel/") && placeBySlug(slug.slice(7))) return <Shell><PlaceView key={slug} place={placeBySlug(slug.slice(7))!} /></Shell>;
  const learn = slug.startsWith("learning/") ? slug.split("/") : [];
  if (learn.length === 3 && content.topics.find((t) => t.subject === learn[1] && t.slug === learn[2])) return <Shell><TopicView key={slug} topic={content.topics.find((t) => t.subject === learn[1] && t.slug === learn[2])!} /></Shell>;
  if (learn.length === 3 && noteBySlug(learn[1], learn[2])) return <Shell><NoteView key={slug} note={noteBySlug(learn[1], learn[2])!} /></Shell>;
  if (learn.length === 2 && subjectBySlug(learn[1])) return <Shell><SubjectView key={slug} subject={subjectBySlug(learn[1])!} /></Shell>;
  return <Shell>{slug === "film/fun" ? <FilmFunView /> : slug.startsWith("film/projects/") && projectBySlug(slug.slice(14)) ? <ProjectView key={slug} project={projectBySlug(slug.slice(14))!} /> : slug === "music/fun" ? <MusicFunView /> : slug.startsWith("music/pieces/") && pieceBySlug(slug.slice(13)) ? <PieceView key={slug} piece={pieceBySlug(slug.slice(13))!} /> : slug.startsWith("music/doses/") && doseBySlug(slug.slice(12)) ? <DoseView key={slug} dose={doseBySlug(slug.slice(12))!} /> : bySlug(slug) ? <DisciplineView key={slug} slug={slug as Slug} /> : slug.startsWith("work/") && workBySlug(slug.slice(5)) ? <WorkView key={slug} piece={workBySlug(slug.slice(5))!} /> : slug === "blog" ? <BlogView /> : slug.startsWith("blog/") && postBySlug(slug.slice(5)) ? <PostView key={slug} post={postBySlug(slug.slice(5))!} /> : slug === "contact" ? <ContactView /> : slug === "privacy" ? <PrivacyView /> : slug === "" ? <HomeView /> : slug === "locked" ? <Lost code={403} /> : slug === "broken" ? <Lost code={500} error="TypeError: the example page tripped over its own feet" reset={() => location.reload()} /> : <Lost code={404} />}</Shell>;
}

// The preview has no server, so "Now listening" is answered here with an entry that says it is a sample.
const realFetch = window.fetch.bind(window);
const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }));
const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
window.fetch = (input, init) =>
  String(input).startsWith("/sounds/")
    ? Promise.resolve((SOUNDS as Record<string, string>)[String(input).slice(8)] ? new Response(bytes((SOUNDS as Record<string, string>)[String(input).slice(8)]), { headers: { "Content-Type": "audio/mpeg" } }) : new Response("", { status: 404 }))
    : String(input).startsWith("/api/sport/summary")
    ? json({ sample: true, ...summarise(demoActivities()), health: [], lastSync: "" })
    : String(input).startsWith("/api/admin/health")
    ? json({ health: sampleHealth() })
    : String(input).startsWith("/api/sport/log")
    ? json(demoLog())
    : String(input).startsWith("/api/sport/padel")
    ? json(demoPadel())
    : String(input).startsWith("/api/sport/rides")
    ? json(demoRides())
    : String(input).startsWith("/api/sport/activities")
    ? json(((p) => listActivities(demoActivities(), { sport: p.get("sport") ?? "", year: p.get("year") ?? "", q: p.get("q") ?? "", offset: Number(p.get("offset")) || 0 }))(new URLSearchParams(String(input).split("?")[1] ?? "")))
    : String(input).startsWith("/api/admin/session")
    ? json({ signedIn: true, database: true, passwordSet: true }) // so the preview shows what I see when signed in
    : String(input).startsWith("/api/now-playing")
    ? Promise.resolve(new Response(JSON.stringify({ configured: true, playing: true, sample: true, title: "Your track here", artist: "Artist", url: "", art: "" }), { headers: { "Content-Type": "application/json" } }))
    : /^\/api\/(instagram|youtube)/.test(String(input))
      ? Promise.resolve(new Response(JSON.stringify({ configured: false }), { headers: { "Content-Type": "application/json" } }))
      : SCORES[String(input)]
      ? Promise.resolve(new Response(SCORES[String(input)], { headers: { "Content-Type": "application/xml" } }))
      : realFetch(input, init);

try {
  const t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch {}

createRoot(document.getElementById("root")!).render(
  <Root />,
);
