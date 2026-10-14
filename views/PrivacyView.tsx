import { Footer } from "@/components/Footer";
import { TLink } from "@/components/Transition";
import { site } from "@/lib/site";

const d = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as React.CSSProperties;

// A plain account of what this site does with data.
export function PrivacyView() {
  const cards: [string, React.ReactNode][] = [
    ["The short version", <p key="a">This is a personal site. It has no adverts, no analytics and no tracking, and it does not set cookies for visitors. (The one cookie it knows is the one that signs me in to edit it.)</p>],
    [
      "What stays on your device",
      <ul key="b">
        <li>Your light or dark choice, if you press the theme button.</li>
        <li>Your best scores in the padel game and the reaction test.</li>
        <li>These are kept in your browser&rsquo;s own storage, are never sent anywhere, and go when you clear your site data.</li>
      </ul>,
    ],
    [
      "If you contact me",
      <p key="c">
        The forms on this site do not send anything themselves. They open a draft in your own email app, and nothing leaves your device until you press send there. If you email me, I will have your address and your message, and I will use them only to reply.
      </p>,
    ],
    [
      "Other services this site talks to",
      <ul key="d">
        <li>GitHub: to show my latest repository, your browser asks GitHub&rsquo;s public API directly. GitHub will see your IP address, as it would if you visited github.com.</li>
        <li>Music: &ldquo;Now listening&rdquo; is fetched by this site&rsquo;s server, not by your browser, so the music service does not see you. If album artwork is shown, your browser loads that one image from the music service.</li>
        <li>Sport: my activities are copied from my own Strava account by this site&rsquo;s server, and my health numbers are sent by my own phone. Your browser is not sent to Strava unless you follow a link there. Each route has its ends cut off before it is drawn. The street map under a route is made of pictures your browser loads from OpenStreetMap, who will see your IP address and which patch of map you looked at.</li>
        <li>The calculators on the sport tools page work in your browser. What you type into them is not sent or kept.</li>
        <li>Hosting: the server this site runs on keeps standard logs (IP address, time, page) for security and to keep the site running.</li>
        <li>The Résumé and GitHub links take you to other sites with their own policies.</li>
      </ul>,
    ],
    [
      "Questions",
      <p key="e">
        Email <a href={`mailto:${site.email}`}>{site.email}</a> and I will answer, including if you want to know what I hold about you or want it deleted.
      </p>,
    ],
  ];
  return (
    <main className="page" data-kind="privacy">
      <section className="wrap d-hero">
        <div className="d-copy">
          <p className="mono rise">
            <TLink href="/">Home</TLink> / Privacy
          </p>
          <h1 className="rise" style={d(80)}>
            <span className="name">Privacy</span>
          </h1>
          <p className="lede rise" style={d(160)}>
            What this site does with information about you, which is very little.
          </p>
        </div>
      </section>
      <section className="wrap section prose">
        {cards.map(([title, body], n) => (
          <div key={title} className="prose-card glass rise" style={d(220 + n * 70)}>
            <h2>{title}</h2>
            {body}
          </div>
        ))}
        <p className="mono">Last updated October 2026</p>
      </section>
      <Footer />
    </main>
  );
}
