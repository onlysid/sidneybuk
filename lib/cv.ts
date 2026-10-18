// The CV: edited in the admin area, shown at /cv, and turned into a PDF (light and dark) on request.
//
// Writing in the text fields:
//   **bold**                 bold
//   a line starting "- "     a bullet; "  - " (indented) a bullet inside the one above
//   Skills and interests: one row per line, the items separated by " | ".

export type CvJob = { role: string; org: string; when: string; bullets: string };
export type Cv = {
  phone: string;
  linkedin: string;
  summary: string;
  skills: string; // rows of "a | b | c"
  jobs: CvJob[];
  education: string; // lines; **bold** allowed
  interests: string; // rows of "a | b | c"
  updatedAt: string; // ISO
};

export const seedCv: Cv = {
  phone: "+44 7943 202004",
  linkedin: "https://www.linkedin.com/in/onlysid",
  summary:
    "I am a software engineer with 4+ years' experience and a keen interest in web, applications, mathematics and creative problem solving. I have experience as a team leader and a Maths and Physics background (UCL) that I bring to system design and data-heavy problems.",
  skills: ["Python | JavaScript/TypeScript | PHP | Dart | C | SQL | Bash | HTML | CSS", "Django | React | Node.js | Flutter | MySQL/PostgreSQL | Git | Tailwind | WordPress | Linux | Apache | Docker", "Web/App Dev | SysAdmin | DevOps | Cybersecurity | Server Management | System Design | Networking"].join("\n"),
  jobs: [
    {
      role: "Software Engineer",
      org: "Cambridge Logic",
      when: "04/2023 – present",
      bullets: [
        "- Managed, trained and onboarded a small team and led projects of a range of complexity to completion. Attended conferences and gave talks and demos, securing interest and excitement in the products we are building.",
        "- Administer the company's infrastructure: a self-hosted mail server and the Ubuntu/Docker host for all production projects, with automated backups, monitoring and security patching.",
        "- Created and designed many intricate database schemas in **SQL**, taking care with efficient **indexing**, **foreign keys** and **transactions**; connecting to **API endpoints** securely and facilitating tens of thousands of queries per day.",
        "- **TOM – Table Operations Manager – Lead Engineer**",
        "  - Built an offline-capable, on-premise system (Dockerised **Django**, **Next.js**, **PostgreSQL**, **Celery**) that tracks live casino games. It provides analytics, a game ledger and **OTA updates**, and ships as a custom **Ubuntu ISO**.",
        "  - Designed hardware-bound licensing against a cloud portal (licence minting, distributor orders, invoicing), with releases built through a tested **CI/CD** pipeline, cryptographically signed and verified on each appliance, plus anti-tamper protection.",
        "  - Implemented an analytics engine with automatic bias detection and a real-time alerts and notifications system.",
        "  - Built a per-appliance certificate authority with auto-renewing **TLS** and support for customer certificates.",
        "  - Integrated IP cameras and dealer displays with discovery, stream verification and two-way sync, using **UDP discovery**, **ONVIF**, **mDNS** and **NTP**.",
        "  - Built role-based access with granular permissions, **LDAP/SSO** login and a full audit trail.",
        "  - Delivered encrypted backup and restore functionality with rollbacks.",
        "  - Maintained version releases, database migrations and support for live sites in several countries.",
        "- **WheelTune – Roulette Wheel Maintenance – Lead Engineer**",
        "  - Built a cross-platform **Flutter** app (**iOS**, **macOS**, **Android**) that calibrates roulette wheels using a **Bluetooth Low Energy** sensor or the phone's own accelerometer and magnetometer.",
        "  - Decoded the sensor data efficiently and rendered it as a real-time custom 2D spirit level.",
        "  - Designed a multi-tenant user model with organisations and users, granular permissions and white-labelling. Each organisation controls its users' UI and branding.",
        "  - Implemented an offline mode using **clean architecture**. Readings queue locally and sync to the API (Dockerised **Next.js**, **Django**, **PostgreSQL**) when the device reconnects.",
        "  - Engineered safeguards against misuse, such as bypassing subscription status or in-app purchases.",
        "  - Shipped features from customer requests with short turnarounds, typically within a week.",
        "- **Hospital Management System – Software Engineer**",
        "  - Built a **PHP Framework**, **DBMS** and **API** to store blood test results securely and allow hospital operators to access historical patient records. Designed a protocol for data transmission, tests for data integrity and a custom auth system.",
      ].join("\n"),
    },
    {
      role: "Web Developer",
      org: "Squarestar Digital",
      when: "02/2022 – 04/2023",
      bullets: [
        "- Used **Next.js** and **React** to create a component library for faster website deployment using custom block templates.",
        "- Managed and built full projects, from idea/proposal to launch using **HTML**, **CSS**, **JavaScript**, **PHP**, **SQL**, **AJAX** and **Tailwind** to create **WordPress** themes and plugins for bespoke websites, using **Git** for version control.",
        "- Developed strong front-end capabilities and an ability to take a design and put it into code quickly and accurately. Also gained knowledge in **caching**, **debugging** and **documentation development** as well as **REST API** creation.",
      ].join("\n"),
    },
    {
      role: "Web Developer and Video Editor",
      org: "Freelance",
      when: "2020 – present",
      bullets: [
        "- Built and designed websites using **React**, **Node.js**, **Next.js**, **Vite**, **PHP**, **HTML**, **CSS** and **WordPress**. These websites use a number of tools such as **Git** for version control, **MySQL** and **Strapi** for data management and have been deployed on personally-run servers using **LAMP/MERN** stacks and containerisation tools such as **Docker**.",
        "- Created and maintained a website and **progressive web app** (built with **WordPress**) for an online fitness community.",
        "- Edited videos for Sky Showcase, taking episodes of shows and creating files optimised and ready for deployment on TV (colour correction, audio mastering, formatting) using **Final Cut Pro X**.",
      ].join("\n"),
    },
    { role: "Private Tutor", org: "", when: "2015 – 2022", bullets: "- Taught A-Level and GCSE Mathematics, Guitar and Piano" },
  ],
  education: ["**University College London – BSc Mathematics and Physics, 2020**", "**A-levels:** Mathematics (A*), Further Mathematics (A*), Physics (A), Chemistry (B)", "**GCSEs:** Maths, Physics, Chemistry, Biology, English (Literature), English (Language), Theatre Studies, IT, Astronomy, French, Geography"].join("\n"),
  interests: ["Piano | Guitar | Education | Photography | Videography | Video Editing | Final Cut Pro | Languages | Singing", "Mathematics | Physics | Astronomy"].join("\n"),
  updatedAt: "2026-10-17T00:00:00.000Z",
};

// ---- Reading the text fields -----------------------------------------------------------------------------------------

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

export type Bullet = { text: string; depth: 0 | 1 };
// The bullets field: "- " lines and "  - " lines; anything else continues the line above.
export function bulletsOf(text: string): Bullet[] {
  const out: Bullet[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) continue;
    const m = /^(\s*)[-•]\s+(.*)$/.exec(line);
    if (m) out.push({ text: m[2], depth: m[1].length >= 2 ? 1 : 0 });
    else if (out.length) out[out.length - 1].text += ` ${line.trim()}`;
    else out.push({ text: line.trim(), depth: 0 });
  }
  return out;
}

// Rows of "a | b | c".
export const rowsOf = (text: string) => text.split("\n").map((l) => l.split("|").map((x) => x.trim()).filter(Boolean)).filter((r) => r.length);
export const linesOf = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

export const stamp = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
