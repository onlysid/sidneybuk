import "server-only";
import path from "node:path";
import { Document, Font, Image, Link, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { runsOf, stamp, type Cv } from "@/lib/cv";
import { site } from "@/lib/site";

// The CV as a PDF, in the site's own type and either of its colour schemes: Bricolage for the name and headings,
// Instrument Sans for the words, JetBrains Mono for the small labels. A4, with the date it was last edited at the
// foot of every page.

const fontsDir = path.join(process.cwd(), "lib", "cv", "fonts");
let registered = false;
function fonts() {
  if (registered) return;
  registered = true;
  const f = (name: string) => path.join(fontsDir, name);
  Font.register({
    family: "Body",
    fonts: [
      { src: f("instrument-400.ttf"), fontWeight: 400 },
      { src: f("instrument-400i.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: f("instrument-500.ttf"), fontWeight: 500 },
      { src: f("instrument-600.ttf"), fontWeight: 600 },
      { src: f("instrument-600i.ttf"), fontWeight: 600, fontStyle: "italic" },
      { src: f("instrument-700.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({ family: "Display", fonts: [{ src: f("bricolage-600.ttf"), fontWeight: 600 }, { src: f("bricolage-700.ttf"), fontWeight: 700 }] });
  Font.register({ family: "Mono", fonts: [{ src: f("jetbrains-500.ttf"), fontWeight: 500 }] });
  Font.registerHyphenationCallback((word) => [word]);
}

export type Theme = "light" | "dark";
const PALETTE = {
  light: { bg: "#f6f2f5", card: "#ffffff", text: "#201a26", muted: "#6a6070", accent: "#6b4a8a", rose: "#c58fb4", edge: "#e4dbe6", chip: "#f1eaf2", link: "#6b4a8a" },
  dark: { bg: "#201a26", card: "#2a2231", text: "#f3eef2", muted: "#aea4b6", accent: "#dcb3cf", rose: "#dcb3cf", edge: "#3b3243", chip: "#332a3b", link: "#dcb3cf" },
};

function sheet(theme: Theme) {
  const c = PALETTE[theme];
  return StyleSheet.create({
    page: { backgroundColor: c.bg, color: c.text, fontFamily: "Body", fontSize: 9, lineHeight: 1.45, paddingTop: 36, paddingBottom: 44, paddingHorizontal: 40 },
    // Head: name on the left, the ways to reach me on the right.
    head: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 6 },
    name: { fontFamily: "Display", fontWeight: 700, fontSize: 26, lineHeight: 1.15, letterSpacing: -0.3, color: c.text },
    headline: { fontFamily: "Mono", fontSize: 7.2, lineHeight: 1.3, letterSpacing: 1.2, textTransform: "uppercase", color: c.muted, marginTop: 3 },
    reach: { alignItems: "flex-end" },
    reachLine: { fontSize: 8.4, color: c.muted, marginTop: 1.5 },
    link: { color: c.link, textDecoration: "none" },
    stripe: { height: 2, borderRadius: 2, marginTop: 10, marginBottom: 12, backgroundColor: c.rose },
    summary: { fontSize: 9.6, lineHeight: 1.5, color: c.text, marginBottom: 6 },
    // Sections: a small mono label with a rule running on from it.
    section: { marginTop: 14 },
    label: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
    labelText: { fontFamily: "Mono", fontSize: 7.2, letterSpacing: 1.4, textTransform: "uppercase", color: c.accent },
    labelRule: { flexGrow: 1, height: 0.8, backgroundColor: c.edge, marginLeft: 8 },
    // Skills as chips in groups.
    skillGroup: { flexDirection: "row", alignItems: "flex-start", marginBottom: 5 },
    skillLabel: { width: 92, fontFamily: "Mono", fontSize: 6.8, letterSpacing: 0.8, textTransform: "uppercase", color: c.muted, paddingTop: 3.5 },
    chips: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
    chip: { fontSize: 8, lineHeight: 1, color: c.text, backgroundColor: c.chip, borderWidth: 1, borderColor: c.edge, borderRadius: 9, paddingTop: 3.2, paddingBottom: 3.4, paddingHorizontal: 6.5, marginRight: 4, marginBottom: 4 },
    // Jobs.
    job: { marginTop: 9 },
    jobHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    jobRole: { fontFamily: "Display", fontWeight: 600, fontSize: 11.5, color: c.text },
    jobOrg: { color: c.muted, fontWeight: 500 },
    jobWhen: { fontFamily: "Mono", fontSize: 7, letterSpacing: 0.6, color: c.muted },
    bullet: { flexDirection: "row", marginTop: 3.2 },
    dot: { width: 9, fontSize: 9, color: c.rose, paddingTop: 0.5 },
    text: { flex: 1 },
    bold: { fontWeight: 700 },
    // A project within a job: its own card.
    project: { marginTop: 7, marginLeft: 9, padding: 9, paddingTop: 7, borderRadius: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.edge },
    projectHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 1 },
    projectName: { fontWeight: 700, fontSize: 9.4, color: c.text },
    projectRole: { fontFamily: "Mono", fontSize: 6.4, lineHeight: 1, letterSpacing: 0.8, textTransform: "uppercase", color: c.accent, backgroundColor: c.chip, borderRadius: 6, paddingTop: 2.6, paddingBottom: 2.8, paddingHorizontal: 5.5 },
    eduLine: { marginTop: 3.5 },
    // Foot: its own line height and height, or the page's would swallow it.
    foot: { position: "absolute", left: 40, right: 40, bottom: 18, height: 12, fontFamily: "Mono", fontSize: 6.6, letterSpacing: 0.8, textTransform: "uppercase", lineHeight: 1.2, color: c.muted, textAlign: "center" },
  });
}
type Styles = ReturnType<typeof sheet>;

function Runs({ text, s, grow }: { text: string; s: Styles; grow?: boolean }) {
  return (
    <Text style={grow ? s.text : undefined}>
      {runsOf(text).map((r, i) => (
        <Text key={i} style={r.bold ? s.bold : undefined}>
          {r.text}
        </Text>
      ))}
    </Text>
  );
}
function Label({ children, s }: { children: string; s: Styles }) {
  return (
    <View style={s.label} minPresenceAhead={50}>
      <Text style={s.labelText}>{children}</Text>
      <View style={s.labelRule} />
    </View>
  );
}
function Bullets({ items, s }: { items: string[]; s: Styles }) {
  return (
    <>
      {items.map((b, k) => (
        <View key={k} style={s.bullet} wrap={false}>
          <Text style={s.dot}>•</Text>
          <Runs text={b} s={s} grow />
        </View>
      ))}
    </>
  );
}

// The site's mark beside the name: the app icon itself.
function Mark() {
  return (
    <View style={{ width: 36, height: 36, borderRadius: 9, overflow: "hidden", marginRight: 11, marginBottom: 2 }}>
      <Image src={path.join(process.cwd(), "public", "icons", "icon-512.png")} style={{ width: 36, height: 36 }} />
    </View>
  );
}

function CvDocument({ cv, theme }: { cv: Cv; theme: Theme }) {
  const s = sheet(theme);
  return (
    <Document title={`${site.name} – CV`} author={site.name} subject="Curriculum vitae" creator={site.domain} producer={site.domain}>
      <Page size="A4" style={s.page}>
        <View style={s.foot} fixed>
          <Text>{`Last edited ${stamp(cv.updatedAt)}   ·   ${site.domain}/cv`}</Text>
        </View>

        <View style={s.head}>
          <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <Mark />
            <View>
              <Text style={s.name}>{site.name}</Text>
              {cv.headline && <Text style={s.headline}>{cv.headline}</Text>}
            </View>
          </View>
          <View style={s.reach}>
            <Text style={s.reachLine}>
              <Link style={s.link} src={site.url}>
                {site.domain}
              </Link>
            </Text>
            <Text style={s.reachLine}>
              <Link style={s.link} src={`mailto:${site.email}`}>
                {site.email}
              </Link>
            </Text>
            {cv.phone && (
              <Text style={s.reachLine}>
                <Link style={s.link} src={`tel:${cv.phone.replace(/\s+/g, "")}`}>
                  {cv.phone}
                </Link>
              </Text>
            )}
            {cv.linkedin && (
              <Text style={s.reachLine}>
                <Link style={s.link} src={cv.linkedin}>
                  {cv.linkedin.replace(/^https?:\/\/(www\.)?/, "")}
                </Link>
              </Text>
            )}
          </View>
        </View>
        <View style={s.stripe} />
        {cv.summary && (
          <View style={s.summary}>
            <Runs text={cv.summary} s={s} />
          </View>
        )}

        {cv.skills.length > 0 && (
          <View style={s.section}>
            <Label s={s}>Skills</Label>
            {cv.skills.map((g, i) => (
              <View key={i} style={s.skillGroup} wrap={false}>
                <Text style={s.skillLabel}>{g.label}</Text>
                <View style={s.chips}>
                  {g.items.map((item, k) => (
                    <Text key={k} style={s.chip}>
                      {item}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {cv.jobs.length > 0 && (
          <View style={s.section}>
            <Label s={s}>Experience</Label>
            {cv.jobs.map((j, i) => (
              <View key={i} style={s.job}>
                <View style={s.jobHead} minPresenceAhead={36}>
                  <Text style={s.jobRole}>
                    {j.role}
                    {j.org ? <Text style={s.jobOrg}>{`  ·  ${j.org}`}</Text> : null}
                  </Text>
                  {j.when ? <Text style={s.jobWhen}>{j.when.toUpperCase()}</Text> : null}
                </View>
                <Bullets items={j.bullets} s={s} />
                {j.projects.map((p, k) => (
                  <View key={k} style={s.project} wrap={p.bullets.length > 10}>
                    <View style={s.projectHead} minPresenceAhead={30}>
                      <Text style={s.projectName}>{p.name}</Text>
                      {p.role ? <Text style={s.projectRole}>{p.role}</Text> : null}
                    </View>
                    <Bullets items={p.bullets} s={s} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {cv.education.length > 0 && (
          <View style={s.section}>
            <Label s={s}>Education</Label>
            {cv.education.map((l, i) => (
              <View key={i} style={s.eduLine}>
                <Runs text={l} s={s} />
              </View>
            ))}
          </View>
        )}

        {cv.interests.length > 0 && (
          <View style={s.section}>
            <Label s={s}>Interests</Label>
            <View style={s.chips}>
              {cv.interests.map((item, k) => (
                <Text key={k} style={s.chip}>
                  {item}
                </Text>
              ))}
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}

// The finished file. Remembered per theme until the CV changes, so a download never waits on a render.
const made = globalThis as unknown as { __cvPdf?: Record<string, { at: string; bytes: Buffer }> };
export async function cvPdf(cv: Cv, theme: Theme) {
  fonts();
  made.__cvPdf ??= {};
  const kept = made.__cvPdf[theme];
  if (kept && kept.at === cv.updatedAt) return kept.bytes;
  const bytes = Buffer.from(await renderToBuffer(<CvDocument cv={cv} theme={theme} />));
  made.__cvPdf[theme] = { at: cv.updatedAt, bytes };
  return bytes;
}
