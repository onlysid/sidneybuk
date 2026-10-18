// The CV: edited in the admin area, shown at /cv, and turned into a PDF (light and dark) on request.
// Write **like this** for bold anywhere in the text.

export type CvProject = { name: string; role: string; bullets: string[] };
export type CvJob = { role: string; org: string; when: string; bullets: string[]; projects: CvProject[] };
export type CvSkills = { label: string; items: string[] };
export type Cv = {
  headline: string; // under the name: "Software engineer · Cambridge"
  phone: string;
  linkedin: string;
  summary: string;
  skills: CvSkills[];
  jobs: CvJob[];
  education: string[];
  interests: string[];
  updatedAt: string; // ISO
};

export const seedCv: Cv = {
  headline: "Software engineer",
  phone: "+44 7943 202004",
  linkedin: "https://www.linkedin.com/in/onlysid",
  summary:
    "Software engineer with 4+ years' experience and a keen interest in web, applications, mathematics and creative problem solving. I have led a small team, and bring a Maths and Physics background (UCL) to system design and data-heavy problems.",
  skills: [
    { label: "Languages", items: ["Python", "JavaScript / TypeScript", "PHP", "Dart", "C", "SQL", "Bash", "HTML", "CSS"] },
    { label: "Frameworks and tools", items: ["Django", "React", "Next.js", "Node.js", "Flutter", "PostgreSQL / MySQL", "Docker", "Git", "Tailwind", "WordPress", "Linux", "Apache"] },
    { label: "Practice", items: ["Web and app development", "System design", "DevOps", "SysAdmin", "Server management", "Networking", "Cybersecurity"] },
  ],
  jobs: [
    {
      role: "Software Engineer",
      org: "Cambridge Logic",
      when: "04/2023 – present",
      bullets: [
        "Managed, trained and onboarded a small team and led projects of a range of complexity to completion. Attended conferences and gave talks and demos, securing interest and excitement in the products we are building.",
        "Administer the company's infrastructure: a self-hosted mail server and the Ubuntu/Docker host for all production projects, with automated backups, monitoring and security patching.",
        "Designed many intricate database schemas in **SQL**, taking care with efficient **indexing**, **foreign keys** and **transactions**; connecting to **API endpoints** securely and facilitating tens of thousands of queries per day.",
      ],
      projects: [
        {
          name: "TOM – Table Operations Manager",
          role: "Lead Engineer",
          bullets: [
            "Built an offline-capable, on-premise system (Dockerised **Django**, **Next.js**, **PostgreSQL**, **Celery**) that tracks live casino games. It provides analytics, a game ledger and **OTA updates**, and ships as a custom **Ubuntu ISO**.",
            "Designed hardware-bound licensing against a cloud portal (licence minting, distributor orders, invoicing), with releases built through a tested **CI/CD** pipeline, cryptographically signed and verified on each appliance, plus anti-tamper protection.",
            "Implemented an analytics engine with automatic bias detection and a real-time alerts and notifications system.",
            "Built a per-appliance certificate authority with auto-renewing **TLS** and support for customer certificates.",
            "Integrated IP cameras and dealer displays with discovery, stream verification and two-way sync, using **UDP discovery**, **ONVIF**, **mDNS** and **NTP**.",
            "Built role-based access with granular permissions, **LDAP/SSO** login and a full audit trail.",
            "Delivered encrypted backup and restore with rollbacks; maintained releases, migrations and support for live sites in several countries.",
          ],
        },
        {
          name: "WheelTune – Roulette Wheel Maintenance",
          role: "Lead Engineer",
          bullets: [
            "Built a cross-platform **Flutter** app (**iOS**, **macOS**, **Android**) that calibrates roulette wheels using a **Bluetooth Low Energy** sensor or the phone's own accelerometer and magnetometer.",
            "Decoded the sensor data efficiently and rendered it as a real-time custom 2D spirit level.",
            "Designed a multi-tenant user model with organisations and users, granular permissions and white-labelling. Each organisation controls its users' UI and branding.",
            "Implemented an offline mode using **clean architecture**. Readings queue locally and sync to the API (Dockerised **Next.js**, **Django**, **PostgreSQL**) when the device reconnects.",
            "Engineered safeguards against misuse, such as bypassing subscription status or in-app purchases, and shipped customer requests with short turnarounds, typically within a week.",
          ],
        },
        {
          name: "Hospital Management System",
          role: "Software Engineer",
          bullets: ["Built a **PHP framework**, **DBMS** and **API** to store blood test results securely and allow hospital operators to access historical patient records. Designed a protocol for data transmission, tests for data integrity and a custom auth system."],
        },
      ],
    },
    {
      role: "Web Developer",
      org: "Squarestar Digital",
      when: "02/2022 – 04/2023",
      bullets: [
        "Used **Next.js** and **React** to create a component library for faster website deployment using custom block templates.",
        "Managed and built full projects, from idea/proposal to launch using **HTML**, **CSS**, **JavaScript**, **PHP**, **SQL**, **AJAX** and **Tailwind** to create **WordPress** themes and plugins for bespoke websites, using **Git** for version control.",
        "Developed strong front-end capabilities and an ability to take a design and put it into code quickly and accurately. Also gained knowledge in **caching**, **debugging** and **documentation** as well as **REST API** creation.",
      ],
      projects: [],
    },
    {
      role: "Web Developer and Video Editor",
      org: "Freelance",
      when: "2020 – present",
      bullets: [
        "Built and designed websites using **React**, **Node.js**, **Next.js**, **Vite**, **PHP**, **HTML**, **CSS** and **WordPress**, with **Git**, **MySQL** and **Strapi**, deployed on personally-run servers using **LAMP/MERN** stacks and **Docker**.",
        "Created and maintained a website and **progressive web app** (built with **WordPress**) for an online fitness community.",
        "Edited videos for Sky Showcase, taking episodes of shows and creating files optimised and ready for deployment on TV (colour correction, audio mastering, formatting) using **Final Cut Pro X**.",
      ],
      projects: [],
    },
    { role: "Private Tutor", org: "", when: "2015 – 2022", bullets: ["Taught A-Level and GCSE Mathematics, Guitar and Piano."], projects: [] },
  ],
  education: ["**University College London** – BSc Mathematics and Physics, 2020", "**A-levels** – Mathematics (A*), Further Mathematics (A*), Physics (A), Chemistry (B)", "**GCSEs** – Maths, Physics, Chemistry, Biology, English (Literature), English (Language), Theatre Studies, IT, Astronomy, French, Geography"],
  interests: ["Piano", "Guitar", "Singing", "Education", "Photography", "Videography", "Video editing", "Languages", "Mathematics", "Physics", "Astronomy"],
  updatedAt: "2026-10-18T00:00:00.000Z",
};

// ---- Reading the text -----------------------------------------------------------------------------------------------

export type Run = { text: string; bold: boolean };
// "a **b** c" → runs, so both the page and the PDF can set the bold parts.
export function runsOf(text: string): Run[] {
  const out: Run[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let at = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > at) out.push({ text: text.slice(at, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), bold: false });
  return out;
}

export const stamp = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// Whatever was saved before (an earlier shape kept bullets as one text with "- " lines) becomes the present shape.
export function upgradeCv(raw: unknown): Cv {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const list = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : typeof v === "string" ? v.split("\n").map((l) => l.replace(/^\s*[-•]\s*/, "").trim()).filter(Boolean) : []);
  const skills: CvSkills[] = Array.isArray(r.skills)
    ? (r.skills as Record<string, unknown>[]).map((g) => ({ label: str(g?.label), items: list(g?.items) }))
    : typeof r.skills === "string"
      ? r.skills.split("\n").filter((l) => l.trim()).map((l, i) => ({ label: ["Languages", "Frameworks and tools", "Practice"][i] ?? "", items: l.split("|").map((x) => x.trim()).filter(Boolean) }))
      : seedCv.skills;
  const jobs: CvJob[] = Array.isArray(r.jobs)
    ? (r.jobs as Record<string, unknown>[]).map((j) => {
        if (typeof j?.bullets === "string") {
          // The old text: top-level "- " lines, with a bold line followed by "  - " lines being a project.
          const bullets: string[] = [], projects: CvProject[] = [];
          for (const raw of j.bullets.split("\n")) {
            const m = /^(\s*)[-•]\s+(.*)$/.exec(raw.replace(/\s+$/, ""));
            if (!m) continue;
            if (m[1].length >= 2 && projects.length) projects[projects.length - 1].bullets.push(m[2]);
            else if (/^\*\*.+\*\*$/.test(m[2].trim())) {
              const [name, ...rest] = m[2].replace(/\*\*/g, "").split(/\s[–—-]\s/);
              projects.push({ name: name.trim(), role: rest.join(" – ").trim(), bullets: [] });
            } else bullets.push(m[2]);
          }
          return { role: str(j.role), org: str(j.org), when: str(j.when), bullets, projects };
        }
        return {
          role: str(j?.role),
          org: str(j?.org),
          when: str(j?.when),
          bullets: list(j?.bullets),
          projects: Array.isArray(j?.projects) ? (j.projects as Record<string, unknown>[]).map((p) => ({ name: str(p?.name), role: str(p?.role), bullets: list(p?.bullets) })) : [],
        };
      })
    : seedCv.jobs;
  return {
    headline: str(r.headline) || seedCv.headline,
    phone: str(r.phone),
    linkedin: str(r.linkedin),
    summary: str(r.summary),
    skills,
    jobs,
    education: list(r.education),
    interests: typeof r.interests === "string" ? r.interests.split(/\n|\|/).map((x) => x.trim()).filter(Boolean) : list(r.interests),
    updatedAt: str(r.updatedAt) || seedCv.updatedAt,
  };
}
