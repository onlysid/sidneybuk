import "server-only";
import path from "node:path";
import {
  Document,
  Font,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { bulletsOf, linesOf, rowsOf, runsOf, stamp, type Cv } from "@/lib/cv";
import { site } from "@/lib/site";

// The CV as a PDF, in the site's own type and either of its two colour schemes. A4, with the date it was last
// edited stamped at the foot of every page.

const fontsDir = path.join(process.cwd(), "lib", "cv", "fonts");
let registered = false;
function fonts() {
  if (registered) return;
  registered = true;
  Font.register({
    family: "Body",
    fonts: [
      { src: path.join(fontsDir, "instrument-400.ttf"), fontWeight: 400 },
      {
        src: path.join(fontsDir, "instrument-400i.ttf"),
        fontWeight: 400,
        fontStyle: "italic",
      },
      { src: path.join(fontsDir, "instrument-500.ttf"), fontWeight: 500 },
      { src: path.join(fontsDir, "instrument-600.ttf"), fontWeight: 600 },
      {
        src: path.join(fontsDir, "instrument-600i.ttf"),
        fontWeight: 600,
        fontStyle: "italic",
      },
      { src: path.join(fontsDir, "instrument-700.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Display",
    fonts: [
      { src: path.join(fontsDir, "bricolage-600.ttf"), fontWeight: 600 },
      { src: path.join(fontsDir, "bricolage-700.ttf"), fontWeight: 700 },
    ],
  });
  // No hyphenation: words stay whole, as on the site.
  Font.registerHyphenationCallback((word) => [word]);
}

export type Theme = "light" | "dark";
const PALETTE = {
  light: {
    bg: "#ffffff",
    text: "#201a26",
    muted: "#5b5260",
    accent: "#6b4a8a",
    rule: "#d9cfe0",
    link: "#6b4a8a",
  },
  dark: {
    bg: "#201a26",
    text: "#f3eef2",
    muted: "#b7adbf",
    accent: "#dcb3cf",
    rule: "#3d3345",
    link: "#dcb3cf",
  },
};

function sheet(theme: Theme) {
  const c = PALETTE[theme];
  return StyleSheet.create({
    page: {
      backgroundColor: c.bg,
      color: c.text,
      fontFamily: "Body",
      fontSize: 9.2,
      paddingTop: 40,
      paddingBottom: 46,
      paddingHorizontal: 44,
    },
    para: {},
    name: {
      fontFamily: "Display",
      fontWeight: 700,
      fontSize: 20,
      textAlign: "center",
      letterSpacing: 0.4,
      color: c.text,
    },
    contact: {
      textAlign: "center",
      marginTop: 6,
      color: c.muted,
      fontSize: 8.8,
    },
    link: { color: c.link, textDecoration: "none" },
    sep: { color: c.muted },
    summary: {
      marginTop: 14,
      textAlign: "center",
      fontSize: 9.4,
      color: c.text,
      paddingHorizontal: 8,
      lineHeight: 1.5,
    },
    section: { marginTop: 16 },
    heading: {
      fontFamily: "Display",
      fontWeight: 600,
      fontSize: 13,
      color: c.accent,
      flexDirection: "row",
      alignItems: "center",
    },
    rule: {
      flexGrow: 1,
      borderBottomWidth: 0.8,
      borderBottomColor: c.rule,
      marginLeft: 8,
      marginTop: 2,
    },
    row: { textAlign: "center", color: c.text, marginTop: 2 },
    job: { marginTop: 9 },
    role: {
      fontWeight: 700,
      fontSize: 9.6,
      textTransform: "uppercase",
      letterSpacing: 0.3,
      color: c.text,
    },
    bullet: { flexDirection: "row", marginTop: 3.2, paddingLeft: 2 },
    bullet1: { flexDirection: "row", marginTop: 2.6, paddingLeft: 16 },
    dot: { width: 10, color: c.muted },
    text: { flex: 1 },
    bold: { fontWeight: 700 },
    eduLine: { marginTop: 4 },
    // Its own line height and height: without them the page's line height swallows a fixed footer.
    foot: {
      position: "absolute",
      left: 44,
      right: 44,
      bottom: 20,
      height: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      fontSize: 7.4,
      lineHeight: 1.2,
      color: c.muted,
    },
  });
}

type Styles = ReturnType<typeof sheet>;

function Runs({ text, s, grow }: { text: string; s: Styles; grow?: boolean }) {
  return (
    <Text style={grow ? s.text : s.para}>
      {runsOf(text).map((r, i) => (
        <Text key={i} style={r.bold ? s.bold : undefined}>
          {r.text}
        </Text>
      ))}
    </Text>
  );
}

function Rows({ text, s }: { text: string; s: Styles }) {
  return (
    <>
      {rowsOf(text).map((row, i) => (
        <Text key={i} style={s.row}>
          {row.map((item, k) => (
            <Text key={k}>
              {k > 0 && <Text style={s.sep}>{"  |  "}</Text>}
              {item}
            </Text>
          ))}
        </Text>
      ))}
    </>
  );
}

function Heading({ children, s }: { children: string; s: Styles }) {
  return (
    <View style={s.heading} minPresenceAhead={60}>
      <Text>{children}</Text>
      <View style={s.rule} />
    </View>
  );
}

function CvDocument({ cv, theme }: { cv: Cv; theme: Theme }) {
  const s = sheet(theme);
  const edited = `Last edited ${stamp(cv.updatedAt)}`;
  return (
    <Document
      title={`${site.name} – CV`}
      author={site.name}
      subject="Curriculum vitae"
      creator={site.domain}
      producer={site.domain}
    >
      <Page size="A4" style={s.page}>
        <View style={s.foot} fixed>
          <Text>{`${edited}  ·  ${site.domain}/cv`}</Text>
        </View>
        <Text style={s.name}>{site.name.toUpperCase()}</Text>
        <Text style={s.contact}>
          <Link style={s.link} src={site.url}>
            {site.domain}
          </Link>
          <Text style={s.sep}>{"  |  "}</Text>
          {cv.phone && (
            <>
              <Link style={s.link} src={`tel:${cv.phone.replace(/\s+/g, "")}`}>
                {cv.phone}
              </Link>
              <Text style={s.sep}>{"  |  "}</Text>
            </>
          )}
          <Link style={s.link} src={`mailto:${site.email}`}>
            {site.email}
          </Link>
          {cv.linkedin && (
            <>
              <Text style={s.sep}>{"  |  "}</Text>
              <Link style={s.link} src={cv.linkedin}>
                LinkedIn
              </Link>
            </>
          )}
        </Text>
        {cv.summary.trim() && (
          <View style={s.summary}>
            <Runs text={cv.summary.trim()} s={s} />
          </View>
        )}

        {cv.skills.trim() && (
          <View style={s.section}>
            <Heading s={s}>Skills</Heading>
            <View style={{ marginTop: 4 }}>
              <Rows text={cv.skills} s={s} />
            </View>
          </View>
        )}

        {cv.jobs.length > 0 && (
          <View style={s.section}>
            <Heading s={s}>Experience</Heading>
            {cv.jobs.map((j, i) => (
              <View key={i} style={s.job}>
                <Text style={s.role} minPresenceAhead={40}>
                  {[j.role, j.org].filter(Boolean).join(", ")}
                  {j.when ? ` — ${j.when}` : ""}
                </Text>
                {bulletsOf(j.bullets).map((b, k) => (
                  <View
                    key={k}
                    style={b.depth ? s.bullet1 : s.bullet}
                    wrap={false}
                  >
                    <Text style={s.dot}>{b.depth ? "–" : "•"}</Text>
                    <Runs text={b.text} s={s} grow />
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {cv.education.trim() && (
          <View style={s.section}>
            <Heading s={s}>Education</Heading>
            {linesOf(cv.education).map((l, i) => (
              <View key={i} style={s.eduLine}>
                <Runs text={l} s={s} />
              </View>
            ))}
          </View>
        )}

        {cv.interests.trim() && (
          <View style={s.section}>
            <Heading s={s}>Interests</Heading>
            <View style={{ marginTop: 4 }}>
              <Rows text={cv.interests} s={s} />
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}

// The finished file. Remembered per theme until the CV changes, so a download never waits on a render.
const made = globalThis as unknown as {
  __cvPdf?: Record<string, { at: string; bytes: Buffer }>;
};
export async function cvPdf(cv: Cv, theme: Theme) {
  fonts();
  made.__cvPdf ??= {};
  const kept = made.__cvPdf[theme];
  if (kept && kept.at === cv.updatedAt) return kept.bytes;
  const bytes = Buffer.from(
    await renderToBuffer(<CvDocument cv={cv} theme={theme} />),
  );
  made.__cvPdf[theme] = { at: cv.updatedAt, bytes };
  return bytes;
}
