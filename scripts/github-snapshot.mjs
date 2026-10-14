// Refreshes lib/github-data.json.
//   node scripts/github-snapshot.mjs            (60 API requests an hour without a token)
//   GITHUB_TOKEN=… node scripts/github-snapshot.mjs
//
// Two sources:
//  - The public API, for the list of public repositories and their commits.
//  - The contribution calendar from the profile page, for the heat map. That calendar counts
//    everything GitHub counts as a contribution, and includes private repositories as long as
//    "Include private contributions on my profile" is switched on in the GitHub profile settings.
//    It gives numbers per day only: no private repository names or contents are read or saved.
import { writeFileSync } from "node:fs";

const login = process.argv[2] ?? "onlysid";
const headers = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
const get = async (url) => {
  const res = await fetch(url, { headers });
  return res.ok ? res.json() : [];
};

const user = await get(`https://api.github.com/users/${login}`);
const list = (await get(`https://api.github.com/users/${login}/repos?per_page=100&sort=pushed`)).filter((r) => !r.fork);
const days = {};
const repos = [];
for (const r of list) {
  let commits = 0;
  for (let page = 1; page <= 5; page++) {
    const batch = await get(`https://api.github.com/repos/${login}/${r.name}/commits?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) break;
    for (const c of batch) {
      const day = c.commit.author.date.slice(0, 10);
      days[day] = (days[day] ?? 0) + 1;
    }
    commits += batch.length;
    if (batch.length < 100) break;
  }
  repos.push({ name: r.name, description: r.description ?? "", language: r.language ?? "", url: r.html_url, stars: r.stargazers_count, created: r.created_at.slice(0, 10), pushed: r.pushed_at.slice(0, 10), commits });
}

// The calendar, one year at a time from the year the account was made.
const contributions = {};
const since = Number((user.created_at ?? "2020").slice(0, 4));
for (let year = since; year <= new Date().getFullYear(); year++) {
  const html = await fetch(`https://github.com/users/${login}/contributions?from=${year}-01-01&to=${year}-12-31`).then((r) => (r.ok ? r.text() : ""));
  const dateOf = {};
  for (const [, tag] of html.matchAll(/<td([^>]*data-date="[^"]+"[^>]*)>/g)) {
    const date = /data-date="([^"]+)"/.exec(tag)?.[1];
    const id = /\bid="([^"]+)"/.exec(tag)?.[1];
    if (date && id) dateOf[id] = date;
  }
  for (const [, id, text] of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)</g)) {
    const n = Number(/^\s*(\d+) contribution/.exec(text)?.[1] ?? 0);
    if (n && dateOf[id]) contributions[dateOf[id]] = n;
  }
}

const data = {
  generatedAt: new Date().toISOString().slice(0, 10),
  user: { login, repos: user.public_repos, followers: user.followers, since: user.created_at.slice(0, 10) },
  repos,
  days: Object.fromEntries(Object.entries(days).sort()),
  contributions: Object.fromEntries(Object.entries(contributions).sort()),
};
writeFileSync(new URL("../lib/github-data.json", import.meta.url), JSON.stringify(data, null, 1));
console.log(`Saved ${repos.length} repositories, ${Object.values(days).reduce((a, b) => a + b, 0)} public commits and ${Object.values(contributions).reduce((a, b) => a + b, 0)} contributions.`);
