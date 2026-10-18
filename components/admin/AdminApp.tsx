"use client";

import { Pill } from "@/components/Pill";
import { Grow, Reveal, Tabs, useFlip } from "./Motion";
import { DateField } from "./DateField";
import { createPortal } from "react-dom";
import { mutate } from "swr";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, type AdminActivity, type KeyGroup, type Media, type AppleMusicStatus, type Passkeys, type StravaStatus } from "@/lib/admin/api";
import { stamp as cvStamp, type Cv, type CvJob } from "@/lib/cv";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { KIND_NAMES, markOf, PADEL_KINDS, padelResult, RIDE_KINDS, scoreOf, writtenUp, type ActivityLog } from "@/lib/training";
import { counted, lastOf, logged, numberOf, say as sayLift, today, unlogged, type Lift } from "@/lib/gym";
import { FEELS, TYPES, typeName } from "@/lib/runlog";
import { clock, dayOf, dist, sportName } from "@/lib/sport";
import { Markdown } from "@/components/Markdown";
import { FORMS, formFor, type Field, type KindForm } from "@/lib/admin/fields";
import { cardsFrom } from "@/lib/learning";
import { isDraft } from "@/lib/score-draft";
import { slugify, type Entry, type Kind } from "@/lib/admin/kinds";
import type { Settings } from "@/lib/content";
import { AskHost, confirmBox, Sheet, textBox } from "./Ask";
import { Pick } from "@/components/Sport";
import { PlacePicker } from "./PlacePicker";
import { ScoreEditor } from "./ScoreEditor";
import { copyText } from "@/lib/copy";
import { site } from "@/lib/site";

// The admin area: one screen that reads the address to decide what to show.
//   /admin                    everything, at a glance
//   /admin/<kind>             the list of one kind of thing
//   /admin/<kind>/new|<id>    the form for one thing
//   /admin/settings, /admin/connections, /admin/media

type Data = Record<string, unknown>;
const Nav = createContext<(href: string) => void>(() => {});
const Toast = createContext<(text: string, bad?: boolean) => void>(() => {});
// The whole of the form a field sits in, for fields whose choices depend on another field.
const Scope = createContext<Data>({});

function Go({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const go = useContext(Nav);
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        go(href);
      }}
    >
      {children}
    </a>
  );
}

// ---- Reading and writing values by dotted key ("cover.src") -------------------------------------------
const read = (data: Data, key: string): unknown => key.split(".").reduce<unknown>((at, k) => (at && typeof at === "object" ? (at as Data)[k] : undefined), data);
function write(data: Data, key: string, value: unknown): Data {
  const [head, ...rest] = key.split(".");
  const next = { ...data };
  if (rest.length) next[head] = write((data[head] as Data) ?? {}, rest.join("."), value);
  else if (value === undefined) delete next[head];
  else next[head] = value;
  return next;
}

// ---- Text in a box, to the shape the site stores ------------------------------------------------------ Paragraphs: a blank line starts a new one,…
function toBlocks(text: string) {
  const out: string[] = [];
  let now: string[] = [], fenced = false;
  const flush = () => {
    if (now.join("").trim()) out.push(now.join("\n").trimEnd());
    now = [];
  };
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (line.trim().startsWith("```")) fenced = !fenced;
    if (!fenced && !line.trim()) flush();
    else now.push(line);
  }
  flush();
  return out;
}
const SHAPES = {
  blocks: { show: (v: unknown) => (Array.isArray(v) ? v.join("\n\n") : ""), parse: toBlocks },
  lines: { show: (v: unknown) => (Array.isArray(v) ? v.join("\n") : ""), parse: (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean) },
  tags: { show: (v: unknown) => (Array.isArray(v) ? v.join(", ") : ""), parse: (t: string) => t.split(",").map((l) => l.trim()).filter(Boolean) },
  verses: {
    show: (v: unknown) => (Array.isArray(v) ? v.map((verse) => (verse as string[]).join("\n")).join("\n\n") : ""),
    parse: (t: string) => t.replace(/\r/g, "").split(/\n\s*\n/).map((verse) => verse.split("\n").map((l) => l.trim()).filter(Boolean)).filter((verse) => verse.length),
  },
  pairs: {
    show: (v: unknown) => (Array.isArray(v) ? v.map((p) => `${(p as string[])[0]}: ${(p as string[])[1]}`).join("\n") : ""),
    parse: (t: string) =>
      t.split("\n").filter((l) => l.trim()).map((l) => {
        const at = l.indexOf(": ") < 0 ? l.indexOf(":") : l.indexOf(": ");
        return at < 0 ? [l.trim(), ""] : [l.slice(0, at).trim(), l.slice(at + 1).trim()];
      }),
  },
  scores: {
    show: (v: unknown) => (Array.isArray(v) ? v.map((p) => `${(p as [string, number])[0]}: ${(p as [string, number])[1]}`).join("\n") : ""),
    parse: (t: string) =>
      t.split("\n").filter((l) => l.trim()).map((l) => {
        const at = l.lastIndexOf(":");
        const n = at < 0 ? 0 : Number(l.slice(at + 1));
        return [at < 0 ? l.trim() : l.slice(0, at).trim(), Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0];
      }),
  },
} as const;

// A box whose text is kept as typed, and handed up in the stored shape as it changes.
function Shaped({ id, shape, value, onChange, rows, placeholder }: { id: string; shape: keyof typeof SHAPES; value: unknown; onChange: (v: unknown) => void; rows: number; placeholder?: string }) {
  const [text, setText] = useState(() => SHAPES[shape].show(value));
  const change = (t: string) => {
    setText(t);
    onChange(SHAPES[shape].parse(t));
  };
  if (shape === "tags") return <input id={id} value={text} placeholder={placeholder} onChange={(e) => change(e.target.value)} />;
  return <textarea id={id} value={text} rows={rows} placeholder={placeholder} onChange={(e) => change(e.target.value)} />;
}

// ---- Files ---------------------------------------------------------------------------------------------
const ACCEPT = { image: "image/jpeg,image/png,image/webp,image/avif,image/gif", audio: "audio/*,.mp3,.m4a,.wav,.ogg,.flac", score: ".musicxml,.xml,.mxl", any: "" };
const fits = (m: Media, accept: keyof typeof ACCEPT) => accept === "any" || (accept === "image" ? m.mime.startsWith("image/") : accept === "audio" ? m.mime.startsWith("audio/") : /xml/.test(m.mime));
const size = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const isImage = (url: string) => /\.(jpe?g|png|webp|avif|gif)$/i.test(url) || url.startsWith("data:image/");
const isAudio = (url: string) => /\.(mp3|m4a|wav|ogg|flac)$/i.test(url) || url.startsWith("data:audio/");

function FileField({ id, value, accept, onChange }: { id: string; value: string; accept: keyof typeof ACCEPT; onChange: (v: string | undefined) => void }) {
  const toast = useContext(Toast);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState<Media[] | null>(null);
  const send = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange((await api.upload(file)).url);
    } catch (err) {
      toast((err as Error).message, true);
    }
    setBusy(false);
  };
  const short = value.startsWith("data:") ? "Uploaded in this preview" : value;
  return (
    <div className="desk-file">
      {value && isImage(value) && <img key={value} className="desk-thumb desk-swap" src={value} alt="" />}
      <Grow className="desk-file-main">
        {value.startsWith("data:") ? <input id={id} value={short} readOnly /> : <input id={id} key={value.startsWith("/") ? value : "typed"} className="desk-swap" value={value} placeholder="Upload a file, or paste an address" onChange={(e) => onChange(e.target.value || undefined)} />}
        {value && isAudio(value) && <audio controls preload="none" src={value} />}
        <div className="desk-row">
          <button type="button" className="desk-btn" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          </button>
          <button type="button" className="desk-btn" onClick={async () => setLibrary(library ? null : (await api.media().catch(() => [])).filter((m) => fits(m, accept)))}>
            {library ? "Close library" : "Choose from library"}
          </button>
          {value && (
            <button type="button" className="desk-btn desk-quiet" onClick={() => onChange(undefined)}>
              Remove
            </button>
          )}
        </div>
        <input ref={input} type="file" hidden accept={ACCEPT[accept] || undefined} onChange={(e) => (send(e.target.files?.[0]), (e.target.value = ""))} />
        {library && (
          <div className="desk-pick desk-swap">
            {library.length === 0 && <p className="desk-help">Nothing of this kind has been uploaded yet.</p>}
            {library.map((m) => (
              <button type="button" key={m.id} className="desk-pick-item" title={m.name} onClick={() => (onChange(m.url), setLibrary(null))}>
                {m.mime.startsWith("image/") ? <img src={m.url} alt="" loading="lazy" /> : <span className="desk-pick-file">{m.name.split(".").pop()}</span>}
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        )}
      </Grow>
    </div>
  );
}

// ---- One field, and a set of them ----------------------------------------------------------------------
function FieldBox({ field, value, onChange, path }: { field: Field; value: unknown; onChange: (v: unknown) => void; path: string }) {
  const id = `ad-${path}`.replace(/\./g, "-");
  const text = value === undefined || value === null ? "" : String(value);
  let control: React.ReactNode;
  switch (field.type) {
    case "text":
      control = <input id={id} value={text} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "long":
      control = <textarea id={id} value={text} rows={3} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "number":
      control = <input id={id} type="number" inputMode="decimal" step="any" value={text} onChange={(e) => onChange(e.target.value === "" || !Number.isFinite(Number(e.target.value)) ? undefined : Number(e.target.value))} />;
      break;
    case "date":
    case "month":
    case "when":
      control = <DateField id={id} value={text} month={field.type === "month"} loose={field.type === "when"} onChange={(v) => onChange(v || undefined)} />;
      break;
    case "check":
      control = <input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
      break;
    case "select":
      control = (
        <span className="desk-pick">
          <Pick label={field.label} value={text} options={field.options.map((o) => [o, o || "As it comes"] as const)} onChange={(v) => onChange(v || undefined)} />
        </span>
      );
      break;
    case "file":
      control = <FileField id={id} value={text} accept={field.accept} onChange={onChange} />;
      break;
    case "list":
      control = <ListField field={field} value={Array.isArray(value) ? (value as Data[]) : []} onChange={onChange} path={path} />;
      break;
    case "markdown":
      control = <MarkdownField id={id} value={text} rows={field.rows ?? 14} onChange={onChange} />;
      break;
    case "ref":
      control = <RefField id={id} field={field} value={text} onChange={onChange} />;
      break;
    default:
      control = <Shaped id={id} shape={field.type as keyof typeof SHAPES} value={value} onChange={onChange} placeholder={"placeholder" in field ? field.placeholder : undefined} rows={field.type === "blocks" ? 14 : field.type === "verses" ? 10 : 6} />;
  }
  return (
    <div className="desk-field" data-wide={field.wide || field.type === "list" || field.type === "file" || field.type === "markdown" ? "true" : undefined}>
      <label htmlFor={field.type === "list" ? undefined : id}>{field.label}</label>
      {control}
      {field.help && <p className="desk-help">{field.help}</p>}
    </div>
  );
}

function Fields({ fields, data, onChange, path }: { fields: Field[]; data: Data; onChange: (d: Data) => void; path: string }) {
  return (
    <Scope.Provider value={data}>
      <div className="desk-fields">
        {fields.map((f) => (
          <FieldBox key={f.key} field={f} path={`${path}-${f.key}`} value={read(data, f.key)} onChange={(v) => onChange(write(data, f.key, v))} />
        ))}
      </div>
    </Scope.Provider>
  );
}

// Choosing one of something else: the subject a topic belongs to, the topic a note belongs to.
const refCache = new Map<string, Promise<Entry[]>>();
function RefField({ id, field, value, onChange }: { id: string; field: Extract<Field, { type: "ref" }>; value: string; onChange: (v: unknown) => void }) {
  const scope = useContext(Scope);
  const [list, setList] = useState<Entry[] | null>(null);
  useEffect(() => {
    let live = true;
    // Asked for once per visit to the form; a new subject or topic shows after leaving the form and coming back.
    if (!refCache.has(field.of)) refCache.set(field.of, api.list(field.of));
    refCache.get(field.of)!.then((l) => live && setList(l), () => live && setList([]));
    return () => void (live = false);
  }, [field.of]);
  useEffect(() => () => void refCache.delete(field.of), [field.of]);
  const inside = field.within ? String(scope[field.within] ?? "") : "";
  const options = (list ?? []).filter((e) => !field.within || String(e.data[field.within] ?? "") === inside);
  // A topic chosen under one subject does not carry over when the subject is changed.
  const stale = !!list && !!field.within && !!value && !options.some((e) => e.slug === value);
  useEffect(() => {
    if (stale) onChange("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale]);
  return (
    <span className="desk-pick" id={id}>
      <Pick
        label={field.label}
        value={options.some((e) => e.slug === value) ? value : ""}
        options={[["", !list ? "Loading…" : field.none ?? (options.length ? "Choose…" : field.within && !inside ? `Choose the ${field.within} first` : "None yet: make one first")] as const, ...options.map((e) => [e.slug, e.title] as const)]}
        onChange={(v) => onChange(v || (field.none ? "" : undefined))}
      />
    </span>
  );
}

// Writing in Markdown: a row of buttons for the things a note can hold, and a look at how it will read.
const SNIPPETS: { label: string; tip: string; wrap?: [string, string]; block?: string }[] = [
  { label: "B", tip: "Bold", wrap: ["**", "**"] },
  { label: "I", tip: "Italic", wrap: ["*", "*"] },
  { label: "H", tip: "Heading", block: "## Heading" },
  { label: "List", tip: "A list", block: "- First\n- Second" },
  { label: "Link", tip: "A link", wrap: ["[", "](https://)"] },
  { label: "x²", tip: "Maths in a line: LaTeX between dollar signs", wrap: ["$", "$"] },
  { label: "∑", tip: "An equation on its own line", block: "$$\n\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}\n$$" },
  { label: "Box", tip: "A boxed aside: note, tip, warning, definition, theorem, proof, example", block: "> [!note]\n> Something worth setting apart." },
  { label: "Diagram", tip: "Boxes and arrows", block: "```diagram\nOne thing -> Another: because\nAnother -> A third\n```" },
  { label: "Cards", tip: "Flashcards, which also join the topic's deck", block: "```cards\nfront :: back\nquestion :: answer\n```" },
  { label: "Demo", tip: "One of the site's interactive pieces: string, tuning, time-signatures, double-slit, proofs, camera, reaction, pace", block: "```demo\ndouble-slit\n```" },
  { label: "Table", tip: "A table", block: "| Word | Meaning |\n|---|---|\n| labas | hello |" },
  { label: "Code", tip: "Code", block: "```js\nconst x = 1;\n```" },
];
function MarkdownField({ id, value, rows, onChange }: { id: string; value: string; rows: number; onChange: (v: string) => void }) {
  const toast = useContext(Toast);
  const area = useRef<HTMLTextAreaElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const [look, setLook] = useState(false);
  const [busy, setBusy] = useState(false);
  // Put something in where the cursor is, and leave the cursor somewhere useful.
  const insert = (before: string, after = "", alone = false) => {
    const el = area.current;
    const from = el?.selectionStart ?? value.length, to = el?.selectionEnd ?? value.length;
    const chosen = value.slice(from, to);
    const lead = alone && from > 0 && !value.slice(0, from).endsWith("\n\n") ? (value.slice(0, from).endsWith("\n") ? "\n" : "\n\n") : "";
    const tail = alone && !value.slice(to).startsWith("\n") ? "\n\n" : "";
    const text = `${lead}${before}${chosen}${after}${tail}`;
    onChange(value.slice(0, from) + text + value.slice(to));
    window.requestAnimationFrame(() => {
      el?.focus();
      const at = from + lead.length + before.length;
      el?.setSelectionRange(at, at + chosen.length);
    });
  };
  const upload = async (files: File[]) => {
    setBusy(true);
    for (const file of files) {
      try {
        const m = await api.upload(file);
        insert(`![${file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")}](${m.url})`, "", true);
      } catch (err) {
        toast(`${file.name}: ${(err as Error).message}`, true);
      }
    }
    setBusy(false);
  };
  return (
    <div className="desk-md">
      <div className="desk-md-bar">
        {SNIPPETS.map((sn) => (
          <button key={sn.label} type="button" className="desk-md-btn" title={sn.tip} disabled={look} onClick={() => (sn.wrap ? insert(sn.wrap[0], sn.wrap[1]) : insert(sn.block ?? "", "", true))}>
            {sn.label}
          </button>
        ))}
        <button type="button" className="desk-md-btn" title="A picture, a recording, a video, or a score (MusicXML) that plays" disabled={look || busy} onClick={() => pick.current?.click()}>
          {busy ? "Uploading…" : "Upload"}
        </button>
        <input ref={pick} type="file" hidden multiple onChange={(e) => (upload([...(e.target.files ?? [])]), (e.target.value = ""))} />
        <span className="desk-bar-gap" />
        <button type="button" className="desk-md-btn desk-md-look" aria-pressed={look} onClick={() => setLook(!look)}>
          {look ? "Back to writing" : "Preview"}
        </button>
      </div>
      {look ? (
        <div className="desk-md-preview">{value.trim() ? <Markdown source={value} /> : <p className="desk-help">Nothing written yet.</p>}</div>
      ) : (
        <textarea id={id} ref={area} value={value} rows={rows} spellCheck onChange={(e) => onChange(e.target.value)} placeholder="Write here. A blank line starts a new paragraph." />
      )}
      <details className="desk-help desk-md-help">
        <summary>What can go in a note</summary>
        <ul>
          <li><code>## Heading</code>, <code>**bold**</code>, <code>*italic*</code>, <code>- a list</code>, <code>1. a numbered list</code>, <code>[a link](https://…)</code>, tables.</li>
          <li>Maths: LaTeX between dollar signs, <code>$x^2$</code> in a line or <code>$$ … $$</code> on its own.</li>
          <li>Upload puts in a picture, a recording, a video or a MusicXML score: <code>![caption](address)</code>. A YouTube address works the same way.</li>
          <li><code>```diagram</code> then one arrow a line: <code>A -&gt; B: why</code>. Start with <code>direction: right</code> to run it sideways.</li>
          <li><code>```cards</code> then one card a line: <code>front :: back</code>. They join the topic&apos;s deck.</li>
          <li><code>&gt; [!note]</code> makes a boxed aside. Also tip, warning, example, definition, theorem, proof. Words after the bracket become its title.</li>
        </ul>
      </details>
    </div>
  );
}

// A repeatable group: log entries, pictures, recordings. Each one folds away under its name.
function ListField({ field, value, onChange, path }: { field: Extract<Field, { type: "list" }>; value: Data[]; onChange: (v: unknown) => void; path: string }) {
  const toast = useContext(Toast);
  // Each item keeps a key of its own so that moving or removing one does not muddle what is typed in the others.
  const keys = useRef<number[]>([]);
  const count = useRef(0);
  while (keys.current.length < value.length) keys.current.push(count.current++);
  keys.current.length = value.length;
  const [open, setOpen] = useState<number | null>(null);
  const flip = useFlip<HTMLDivElement>();
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    next.splice(to, 0, next.splice(from, 1)[0]);
    keys.current.splice(to, 0, keys.current.splice(from, 1)[0]);
    onChange(next);
  };
  return (
    <div className="desk-list" ref={flip}>
      {value.map((item, at) => {
        const key = keys.current[at];
        const name = String(item[field.titleKey] ?? "") || `${field.one[0].toUpperCase()}${field.one.slice(1)} ${at + 1}`;
        const thumb = typeof item.src === "string" && isImage(item.src) ? item.src : "";
        return (
          <div className="desk-item" key={key} data-open={open === key}>
            <div className="desk-item-head">
              <button type="button" className="desk-item-name" aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)}>
                {thumb && <img src={thumb} alt="" />}
                <span>{name}</span>
              </button>
              <button type="button" className="desk-icon" aria-label="Move up" disabled={at === 0} onClick={() => move(at, at - 1)}>↑</button>
              <button type="button" className="desk-icon" aria-label="Move down" disabled={at === value.length - 1} onClick={() => move(at, at + 1)}>↓</button>
              <button
                type="button"
                className="desk-icon"
                aria-label={`Remove this ${field.one}`}
                onClick={() => {
                  // Nothing is lost until Save is pressed, so this needs no "are you sure".
                  keys.current.splice(at, 1);
                  onChange(value.filter((_, n) => n !== at));
                  toast(`${name} removed. Press Save to keep the change.`);
                }}
              >
                ×
              </button>
            </div>
            <Sheet open={open === key} onClose={() => setOpen(null)} title={name}>
              <Fields fields={field.fields} data={item} path={`${path}-${key}`} onChange={(d) => onChange(value.map((v, n) => (n === at ? d : v)))} />
              <div className="sheet-foot">
                <button
                  type="button"
                  className="sheet-link sheet-bad"
                  onClick={() => {
                    setOpen(null);
                    keys.current.splice(at, 1);
                    onChange(value.filter((_, n) => n !== at));
                    toast(`${name} removed. Press Save to keep the change.`);
                  }}
                >
                  Remove
                </button>
                <button type="button" className="desk-btn desk-main" onClick={() => setOpen(null)}>
                  Done
                </button>
              </div>
            </Sheet>
          </div>
        );
      })}
      <button
        type="button"
        className="desk-btn"
        onClick={() => {
          keys.current.push(count.current++);
          setOpen(keys.current[keys.current.length - 1]);
          onChange([...value, {}]);
        }}
      >
        Add {/^[aeiou]/.test(field.one) ? "an" : "a"} {field.one}
      </button>
    </div>
  );
}

// ---- Screens --------------------------------------------------------------------------------------------
function Head({ trail, title, children }: { trail: [string, string][]; title: string; children?: React.ReactNode }) {
  return (
    <header className="desk-head">
      <p className="mono">
        {trail.map(([label, href]) => (
          <span key={href}>
            <Go href={href}>{label}</Go> /{" "}
          </span>
        ))}
        {title}
      </p>
      <div className="desk-head-row">
        <h1 className="desk-title">{title}</h1>
        {children}
      </div>
    </header>
  );
}

// The first page.
function Dashboard() {
  const [all, setAll] = useState<Entry[] | null>(null);
  const [find, setFind] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all(FORMS.map((f) => api.list(f.kind).catch(() => [] as Entry[]))).then((lists) => live && setAll(lists.flat()));
    return () => void (live = false);
  }, []);
  const nameOfKind = (kind: string) => FORMS.find((f) => f.kind === kind)?.one ?? kind;
  const words = find.toLowerCase().split(/\s+/).filter(Boolean);
  const found = words.length ? (all ?? []).filter((e) => words.every((w) => `${e.title} ${nameOfKind(e.kind)}`.toLowerCase().includes(w))).slice(0, 12) : [];
  // Things started and not yet on the site: anything hidden, and any score still being written.
  const drafts = (all ?? []).filter((e) => !e.published).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const scores = (all ?? []).filter((e) => e.kind === "piece" && isDraft(e.data.scoreDraft) && !e.data.scoreLive);
  const count = (kind: string) => (all ? all.filter((e) => e.kind === kind).length : null);
  const make: [string, string][] = [["post", "Post"], ["note", "Note"], ["book", "Book"], ["piece", "Piece"], ["dose", "Daily dose"], ["project", "Project"], ["place", "Place"]];
  const tools: [string, string, string][] = [
    ["/admin/activities", "Training", "Write up a run, ride, gym or padel"],
    ["/admin/gym", "Gym today", "Tap the machines as you go"],
    ["/admin/cards", "Cards", "Add and group flashcards"],
    ["/admin/cv", "CV", "The page at /cv and its PDFs"],
  ];
  const row = (e: Entry) => (
    <Go key={e.id} href={`/admin/${e.kind}/${e.id}`} className="dash-row">
      <span>{e.title || "Untitled"}</span>
      <em>
        {nameOfKind(e.kind)}
        {e.published ? "" : " · draft"}
      </em>
    </Go>
  );
  return (
    <>
      <Head trail={[]} title="Admin" />
      <input className="desk-find dash-find" type="search" placeholder="Find anything by name" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Find anything" />
      {words.length > 0 ? (
        <section className="dash-block">
          <h2 className="mono">{found.length ? "Found" : "Nothing called that"}</h2>
          <div className="dash-rows glass">{found.map(row)}</div>
        </section>
      ) : (
        <>
          {drafts.length + scores.length > 0 && (
            <section className="dash-block">
              <h2 className="mono">Drafts: started, not on the site yet</h2>
              <div className="dash-rows glass">
                {scores.map((e) => (
                  <Go key={`score-${e.id}`} href={`/admin/score/${e.id}`} className="dash-row">
                    <span>{e.title || "Untitled"}</span>
                    <em>score in progress</em>
                  </Go>
                ))}
                {drafts.map(row)}
              </div>
            </section>
          )}
          <section className="dash-block">
            <h2 className="mono">Do</h2>
            <div className="dash-tiles">
              {tools.map(([href, name, about]) => (
                <Go key={href} href={href} className="dash-tile dash-big glass">
                  <b>{name}</b>
                  <span>{about}</span>
                </Go>
              ))}
            </div>
          </section>
          <section className="dash-block">
            <h2 className="mono">Make a new</h2>
            <div className="dash-make">
              {make.map(([kind, name]) => (
                <Go key={kind} href={`/admin/${kind}/new`} className="sp-chip">
                  + {name}
                </Go>
              ))}
            </div>
          </section>
          <section className="dash-block">
            <h2 className="mono">Everything</h2>
            <div className="dash-tiles">
              {FORMS.map((f) => (
                <Go key={f.kind} href={`/admin/${f.kind}`} className="dash-tile glass">
                  <b>{f.many}</b>
                  <span>{count(f.kind) ?? ""}</span>
                </Go>
              ))}
            </div>
          </section>
          <section className="dash-block">
            <h2 className="mono">The site itself</h2>
            <div className="dash-tiles">
              {[
                ["/admin/settings", "Settings", "Where I am, links, goals"],
                ["/admin/connections", "Connections", "Strava, music, my phone"],
                ["/admin/media", "Media", "Photos, audio, scores"],
              ].map(([href, name, about]) => (
                <Go key={href} href={href} className="dash-tile dash-big glass">
                  <b>{name}</b>
                  <span>{about}</span>
                </Go>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function ListScreen({ form }: { form: KindForm }) {
  const toast = useContext(Toast);
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [find, setFind] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setEntries(null);
    api.list(form.kind).then((list) => live && setEntries(list), (err) => toast(err.message, true));
    return () => void (live = false);
  }, [form.kind, toast]);
  const words = find.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = (entries ?? []).filter((e) => words.every((w) => `${e.title} ${form.summary(e.data)}`.toLowerCase().includes(w)));
  const byDate = form.fields.some((f) => f.key === "date" && f.type === "date");
  // Put one entry a place earlier or later, and store the new order.
  const flip = useFlip<HTMLUListElement>(false);
  const move = async (from: number, to: number) => {
    if (!entries || to < 0 || to >= entries.length || busy) return;
    const next = [...entries];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setEntries(next);
    setBusy(true);
    try {
      const saved = await Promise.all(next.map((e, n) => (e.position === n ? e : api.save(form.kind, { id: e.id, slug: e.slug, data: e.data, published: e.published, position: n }))));
      setEntries(saved);
      router.refresh();
    } catch (err) {
      toast((err as Error).message, true);
    }
    setBusy(false);
  };
  // The examples the site came with are marked as samples: they can all be taken out in one go.
  const samples = (entries ?? []).filter((e) => e.data.sample === true);
  const clearSamples = async () => {
    if (!(await confirmBox(`Delete the ${samples.length} example ${samples.length === 1 ? form.one : form.many.toLowerCase()} the site came with? This cannot be undone. Anything you have added yourself stays.`))) return;
    setBusy(true);
    try {
      for (const e of samples) await api.remove(e.id);
      setEntries(await api.list(form.kind));
      toast(`Deleted ${samples.length}.`);
      router.refresh();
    } catch (err) {
      toast((err as Error).message, true);
    }
    setBusy(false);
  };
  return (
    <>
      <Head trail={[["Admin", "/admin"]]} title={form.many}>
        <Go href={`/admin/${form.kind}/new`} className="desk-btn desk-main">
          New {form.one}
        </Go>
      </Head>
      {(entries?.length ?? 0) > 6 && <input className="desk-find" type="search" placeholder={`Search ${form.many.toLowerCase()}`} value={find} onChange={(e) => setFind(e.target.value)} />}
      {samples.length > 0 && !find && (
        <div className="desk-offer glass">
          <div>
            <b>{samples.length} of these {samples.length === 1 ? "is an example" : "are examples"} the site came with</b>
            <p>They are marked "sample" on the site. Edit them into your own, delete them one at a time, or clear them all here. Deleted ones do not come back.</p>
          </div>
          <button type="button" className="desk-btn desk-danger" disabled={busy} onClick={clearSamples}>
            Delete the examples
          </button>
        </div>
      )}
      {!entries && <p className="desk-help">Loading…</p>}
      {entries && entries.length === 0 && <p className="desk-help">Nothing here yet.</p>}
      {!byDate && (entries?.length ?? 0) > 1 && !find && <p className="desk-help">These appear on the site in this order. Use the arrows to change it.</p>}
      <ul className="desk-entries" ref={flip}>
        {shown.map((e) => {
          const at = entries!.indexOf(e);
          return (
            <li key={e.id} className="desk-entry glass" data-hidden={!e.published}>
              <Go href={`/admin/${form.kind}/${e.id}`} className="desk-entry-main">
                <strong>{e.title || "Untitled"}</strong>
                <span>{form.summary(e.data)}</span>
              </Go>
              {!e.published && <span className="desk-tag">Hidden</span>}
              {!!e.data.sample && <span className="desk-tag">Sample</span>}
              {!byDate && !find && (
                <>
                  <button type="button" className="desk-icon" aria-label="Move up" disabled={at === 0 || busy} onClick={() => move(at, at - 1)}>↑</button>
                  <button type="button" className="desk-icon" aria-label="Move down" disabled={at === entries!.length - 1 || busy} onClick={() => move(at, at + 1)}>↓</button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Editor({ form, id }: { form: KindForm; id: string }) {
  const toast = useContext(Toast);
  const go = useContext(Nav);
  const router = useRouter();
  const fresh = id === "new";
  const [entry, setEntry] = useState<Entry | null>(null);
  const [data, setData] = useState<Data | null>(fresh ? form.blank : null);
  const [slug, setSlug] = useState("");
  const [ownSlug, setOwnSlug] = useState(!fresh);
  const [published, setPublished] = useState(true);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (fresh) return;
    let live = true;
    api.get(id).then(
      (e) => {
        if (!live) return;
        setEntry(e);
        setData(e.data);
        setSlug(e.slug);
        setPublished(e.published);
      },
      () => live && setMissing(true),
    );
    return () => void (live = false);
  }, [id, fresh]);

  // Where to go once the next save has worked, when a button means "save, then take me there".
  const next = useRef<((saved: Entry) => string) | null>(null);
  const [dirty, settle] = useChanged([data, ownSlug ? slug : "", published], !!data);
  // Kept so the places that used to say "this has changed" or "this is saved" read the same.
  const setDirty = (on: boolean) => void (on || settle());

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const title = data ? String(data[form.titleKey] ?? "") : "";
  const address = ownSlug ? slug : slugify(title);
  const save = useCallback(async () => {
    if (!data || busy) return;
    if (!title.trim()) return toast(`Give the ${form.one} a ${form.titleKey} first.`, true);
    setBusy(true);
    try {
      // Once I have edited something it is no longer a sample. Log entries need an address of their own too.
      const { sample: _sample, ...rest } = data;
      const clean: Data = { ...rest };
      if (Array.isArray(clean.entries)) clean.entries = (clean.entries as Data[]).map(({ sample: _s, ...e }) => ({ body: [], frames: [], summary: "", date: "", ...e, slug: slugify(String(e.slug || e.title || "entry")) }));
      const saved = await api.save(form.kind, { id: entry?.id, slug: address, data: clean, published });
      setEntry(saved);
      setData(saved.data);
      setSlug(saved.slug);
      setOwnSlug(true);
      setDirty(false);
      toast(published ? "Saved. It is on the site now." : "Saved, and hidden from the site.");
      router.refresh();
      if (next.current) go(next.current(saved));
      else if (fresh) go(`/admin/${form.kind}/${saved.id}`);
    } catch (err) {
      toast((err as Error).message, true);
    }
    setBusy(false);
  }, [data, busy, title, toast, form, entry, address, published, router, fresh, go]);

  // Cmd or Ctrl and S saves.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [save]);

  if (missing) return <Head trail={[["Admin", "/admin"], [form.many, `/admin/${form.kind}`]]} title="Not found" />;
  if (!data) return <p className="desk-help">Loading…</p>;
  const link = form.url(entry?.slug ?? address, data);
  // A place's position is chosen on a map (below), so the two number boxes for it are left out.
  const mapped = form.kind === "place" || form.kind === "wish";
  const fields = mapped ? form.fields.filter((f) => f.key !== "lat" && f.key !== "lon") : form.fields;
  const first = fields.filter((f) => !f.more), rest = fields.filter((f) => f.more);
  const change = (d: Data) => {
    setData(d);
    setDirty(true);
  };
  return (
    <form
      className="desk-editor"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Head trail={[["Admin", "/admin"], [form.many, `/admin/${form.kind}`]]} title={fresh ? `New ${form.one}` : title || "Untitled"} />
      {mapped && (
        <section className="desk-panel glass">
          <h2 className="desk-h2">Where it is</h2>
          <PlacePicker lat={Number(data.lat) || 0} lon={Number(data.lon) || 0} named={String(data.name ?? "")} onPick={(p) => change({ ...data, lat: p.lat, lon: p.lon, ...(p.name ? { name: p.name } : {}), ...(p.country ? { country: p.country } : {}) })} />
        </section>
      )}
      <section className="desk-panel glass">
        <Fields key={entry?.id ?? "new"} fields={first} data={data} path={form.kind} onChange={change} />
      </section>
      <section className="desk-panel desk-more glass">
        <button type="button" className="desk-more-btn" aria-haspopup="dialog" onClick={() => setMore(true)}>
          <span>
            <b>More</b>
            <small>{[...rest.map((f) => f.label), "Address", ...(entry ? ["Delete"] : [])].join(" · ")}</small>
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <Sheet open={more} onClose={() => setMore(false)} title="More">
            {rest.length > 0 && <Fields key={entry?.id ?? "new"} fields={rest} data={data} path={form.kind} onChange={change} />}
            <div className="desk-fields">
              <div className="desk-field" data-wide="true">
                <label htmlFor="desk-slug">Address</label>
                <input
                  id="desk-slug"
                  value={address}
                  onChange={(e) => {
                    setOwnSlug(true);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"));
                    setDirty(true);
                  }}
                />
                <p className="desk-help">
                  {site.domain}
                  {form.url(address || "…", data)}. It is made from the title. Changing it later breaks links people have already shared.
                </p>
              </div>
            </div>
            <div className="sheet-foot">
            {entry ? (
                <button
                  type="button"
                  className="sheet-link sheet-bad"
                  onClick={async () => {
                    if (!(await confirmBox(`Delete "${title}" for good? This cannot be undone.`))) return;
                    setMore(false);
                    try {
                      await api.remove(entry.id);
                      setDirty(false);
                      toast(`“${title}” deleted.`);
                      router.refresh();
                      go(`/admin/${form.kind}`);
                    } catch (err) {
                      toast((err as Error).message, true);
                    }
                  }}
                >
                  Delete this {form.one}
                </button>
            ) : (
              <span />
            )}
              <button type="button" className="desk-btn desk-main" onClick={() => setMore(false)}>
                Done
              </button>
            </div>
        </Sheet>
      </section>
      {form.kind === "piece" && (
        <div className="desk-offer glass">
          <div>
            <b>Write the score here</b>
            <p>No notation program needed: tap notes in on a piano, see the page as it will look, and the site makes the MusicXML file itself. It saves as you go, so you can stop and come back.{isDraft(data?.scoreDraft) ? (data?.scoreLive ? " This piece has a score written here." : " There is a draft here that is not on the site yet.") : ""}</p>
          </div>
          {entry && !dirty ? (
            <Go href={`/admin/score/${entry.id}`} className="desk-btn">
              {isDraft(data?.scoreDraft) ? "Carry on with the score" : "Write the score"}
            </Go>
          ) : (
            <button
              type="button"
              className="desk-btn"
              disabled={busy}
              onClick={() => {
                next.current = (saved) => `/admin/score/${saved.id}`;
                save().finally(() => (next.current = null));
              }}
            >
              Save, then write the score
            </button>
          )}
        </div>
      )}
      {form.kind === "topic" && entry && (
        <div className="desk-offer glass">
          <div>
            <b>This topic&apos;s flashcards</b>
            <p>{Array.isArray(data?.cards) ? data.cards.length : 0} so far. Add, group and move them on their own screen.</p>
          </div>
          <Go href={`/admin/cards/${entry.slug}`} className="desk-btn">
            Open the cards
          </Go>
        </div>
      )}
      <div className="desk-bar glass">
        <label className="desk-live" data-on={published}>
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => {
              setPublished(e.target.checked);
              setDirty(true);
            }}
          />
          <i aria-hidden="true" />
          <span>{published ? "On the site" : "Hidden"}</span>
        </label>
        <span className="desk-bar-state mono" data-dirty={dirty || fresh}>
          {busy ? "Saving…" : dirty || fresh ? "Not saved yet" : "Saved"}
        </span>
        {entry && published && !dirty && (
          <Go href={link} className="desk-btn desk-quiet">
            View it
          </Go>
        )}
        <button type="submit" className="desk-btn desk-main" disabled={busy || (!dirty && !fresh)}>
          Save
        </button>
      </div>
    </form>
  );
}

const SETTINGS: { title: string; about?: string; fields: Field[] }[] = [
  {
    title: "Where I am",
    about: "Shown on the home and contact pages and on the travel globe. Your phone can keep this up to date by itself: see Connections.",
    fields: [
      { key: "location.name", label: "Place", type: "text", placeholder: "California" },
      { key: "location.timeZone", label: "Time zone", type: "text", placeholder: "America/Los_Angeles", help: "For the local time shown next to it." },
      { key: "location.lat", label: "Latitude", type: "number" },
      { key: "location.lon", label: "Longitude", type: "number" },
      { key: "location.message", label: "A message with it", type: "text", placeholder: "Here for a wedding", help: "Shown under the place. Leave empty for none." },
      { key: "location.away", label: "I am away", type: "check", help: "Shows \"Away\" on the home and contact pages, with the message above (\"Catching rays, back on Tuesday 14th\"). Untick when you are back." },
      { key: "location.until", label: "Until (the day I am back)", type: "date", help: "The away note, or the held place, ends by itself at the start of this day. Leave empty to end it by hand." },
      { key: "location.manual", label: "Hold this place: ignore my phone's automatic updates", type: "check", help: "On, the place and message stay as they are until you untick this (or your phone sends manual: false)." },
    ],
  },
  {
    title: "Working on",
    about: "The line in the bar at the bottom of every page.",
    fields: [
      { key: "workingOn.name", label: "What", type: "text" },
      { key: "workingOn.href", label: "Link", type: "text", placeholder: "/work/…" },
    ],
  },
  {
    title: "Where else to find me",
    about: "Whole addresses. Leave one empty to hide its button.",
    fields: [
      { key: "social.youtube", label: "YouTube", type: "text", placeholder: "https://www.youtube.com/@…" },
      { key: "social.instagram", label: "Instagram", type: "text", placeholder: "https://www.instagram.com/…" },
      { key: "social.spotify", label: "Spotify", type: "text", placeholder: "https://open.spotify.com/user/…" },
      { key: "social.appleMusic", label: "Apple Music", type: "text", placeholder: "https://music.apple.com/profile/…" },
      { key: "social.strava", label: "Strava", type: "text", placeholder: "https://www.strava.com/athletes/…" },
    ],
  },
  {
    title: "Feeds that need no key",
    fields: [
      { key: "integrations.github", label: "GitHub username", type: "text", help: "For the activity chart on the Code page." },
      { key: "integrations.youtubeChannelId", label: "YouTube channel ID", type: "text", placeholder: "UC…", help: "Shows your latest videos on the Film and photo page." },
    ],
  },
  { title: "Reading", fields: [{ key: "yearlyGoal", label: "Books to read this year", type: "number" }] },
  {
    title: "Sport",
    about: "A route that starts at your front door shows where you live. So each route has its two ends cut off before it is drawn, or you can leave routes out altogether.",
    fields: [
      { key: "sport.showMaps", label: "Draw the route on an activity's page", type: "check" },
      { key: "sport.tiles", label: "Put a street map under the route", type: "check", help: "The map pictures come from OpenStreetMap. Off, the route is a line on plain glass and visitors' browsers ask nobody for anything." },
      { key: "sport.trim", label: "Metres cut off each end of a route", type: "number", help: "500 is a sensible least. 0 shows the whole route." },
      { key: "sport.showWeight", label: "Leave my weight in the run log's notes", type: "check", help: "Off takes any weight out of the notes in the run log before visitors see them. (The Fitness charts, weight included, are only ever shown to you, signed in.)" },
      { key: "sport.showNotes", label: "Show the notes in my run log to visitors", type: "check", help: "The Notable column. Off keeps them for your eyes only, here in the admin area." },
      { key: "sport.gymPlan", label: "How I train at the gym", type: "text", help: "Shown at the top of the gym page. Separate the parts with a dot or a comma." },
    ],
  },
];

function SettingsScreen() {
  const toast = useContext(Toast);
  const router = useRouter();
  const [settings, setSettings] = useState<Data | null>(null);
  const [dirty, settle] = useChanged(settings, !!settings);
  const setDirty = (on: boolean) => void (on || settle());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.settings().then((r) => setSettings(r.settings as unknown as Data), (err) => toast(err.message, true));
  }, [toast]);
  if (!settings) return <p className="desk-help">Loading…</p>;
  const save = async () => {
    setBusy(true);
    try {
      const sp = settings.sport as { showMaps?: boolean; tiles?: boolean; trim?: number; showWeight?: boolean; showNotes?: boolean; gymPlan?: string } | undefined;
      const loc = settings.location as { name?: string; lat?: number; lon?: number; timeZone?: string; message?: string; manual?: boolean; away?: boolean; until?: string } | null;
      const next = { ...settings, location: loc?.name ? { name: loc.name, lat: loc.lat ?? 0, lon: loc.lon ?? 0, timeZone: loc.timeZone || "UTC", ...(loc.message?.trim() ? { message: loc.message.trim() } : {}), ...(loc.manual ? { manual: true } : {}), ...(loc.away ? { away: true } : {}), ...(loc.until && (loc.away || loc.manual) ? { until: /^\d{4}-\d{2}-\d{2}$/.test(loc.until) ? new Date(`${loc.until}T00:00:00`).toISOString() : loc.until } : {}) } : null, yearlyGoal: Number(settings.yearlyGoal) || 0, sport: { showMaps: !!sp?.showMaps, tiles: !!sp?.tiles, trim: Math.max(0, Number(sp?.trim) || 0), showWeight: !!sp?.showWeight, showNotes: sp?.showNotes !== false, gymPlan: String(sp?.gymPlan ?? "").trim() } } as unknown as Settings;
      const r = await api.saveSettings({ settings: next });
      setSettings(r.settings as unknown as Data);
      setDirty(false);
      toast("Saved.");
      router.refresh();
    } catch (err) {
      toast((err as Error).message, true);
    }
    setBusy(false);
  };
  return (
    <form
      className="desk-editor"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Head trail={[["Admin", "/admin"]]} title="Settings" />
      {SETTINGS.map((group) => (
        <section className="desk-panel glass" key={group.title}>
          <h2 className="desk-h2">{group.title}</h2>
          {group.about && <p className="desk-help">{group.about}</p>}
          {group.title === "Where I am" && (
            <PlacePicker
              lat={Number((settings.location as Data | null)?.lat) || 0}
              lon={Number((settings.location as Data | null)?.lon) || 0}
              named={String((settings.location as Data | null)?.name ?? "")}
              onPick={(p) => setSettings({ ...settings, location: { ...((settings.location as Data | null) ?? {}), lat: p.lat, lon: p.lon, ...(p.name ? { name: p.name } : {}), ...(p.timeZone ? { timeZone: p.timeZone } : {}) } })}
            />
          )}
          <Fields
            fields={group.fields}
            data={settings}
            path="settings"
            onChange={(d) => {
              setSettings(d);
              setDirty(true);
            }}
          />
        </section>
      ))}
      <div className="desk-bar glass">
        <span className="desk-bar-state mono" data-dirty={dirty}>
          {busy ? "Saving…" : dirty ? "Not saved yet" : "Saved"}
        </span>
        <button type="submit" className="desk-btn desk-main" disabled={busy || !dirty}>
          Save
        </button>
      </div>
    </form>
  );
}

// /admin/cv: the CV, which /cv shows and turns into a PDF.
function CvScreen() {
  const toast = useContext(Toast);
  const router = useRouter();
  const [cv, setCv] = useState<Cv | null>(null);
  const [dirty, settle] = useChanged(cv, !!cv);
  const [busy, setBusy] = useState(false);
  const flip = useFlip<HTMLDivElement>();
  // A key of its own per job, so moving one slides it rather than redrawing the rest.
  const keys = useRef(new WeakMap<CvJob, number>());
  const tally = useRef(0);
  const keyOf = (j: CvJob) => {
    let k = keys.current.get(j);
    if (k === undefined) keys.current.set(j, (k = ++tally.current));
    return k;
  };
  useEffect(() => {
    api.cv().then(setCv, (err) => toast(err.message, true));
  }, [toast]);
  if (!cv) return <Waiting />;
  const put = (next: Partial<Cv>) => setCv({ ...cv, ...next });
  const job = (i: number, next: Partial<CvJob>) =>
    put({
      jobs: cv.jobs.map((j, k) => {
        if (k !== i) return j;
        const fresh = { ...j, ...next };
        keys.current.set(fresh, keyOf(j));
        return fresh;
      }),
    });
  const move = (i: number, by: number) => {
    const jobs = [...cv.jobs];
    const [one] = jobs.splice(i, 1);
    jobs.splice(i + by, 0, one);
    put({ jobs });
  };
  const save = async () => {
    setBusy(true);
    try {
      setCv(await api.saveCv(cv));
      settle();
      toast("Saved. The PDFs are made afresh from this.");
      router.refresh();
    } catch (err) {
      toast((err as Error).message, true);
    }
    setBusy(false);
  };
  const text = (label: string, key: "summary" | "skills" | "education" | "interests", rows: number, help: string) => (
    <div className="desk-field" data-wide="true">
      <label htmlFor={`cv-${key}`}>{label}</label>
      <textarea id={`cv-${key}`} rows={rows} value={cv[key]} onChange={(e) => put({ [key]: e.target.value })} />
      <p className="desk-help">{help}</p>
    </div>
  );
  return (
    <form
      className="desk-editor"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Head trail={[["Admin", "/admin"]]} title="CV">
        <div className="desk-row">
          <a className="desk-btn desk-quiet" href="/cv" target="_blank" rel="noreferrer">
            See the page
          </a>
          <a className="desk-btn desk-quiet" href="/cv/pdf?theme=light" target="_blank" rel="noreferrer">
            PDF light
          </a>
          <a className="desk-btn desk-quiet" href="/cv/pdf?theme=dark" target="_blank" rel="noreferrer">
            PDF dark
          </a>
        </div>
      </Head>
      <p className="desk-lede">
        What is here becomes the page at /cv and both PDFs the moment it is saved, stamped &ldquo;Last edited {cvStamp(cv.updatedAt)}&rdquo;. Write <code>**like this**</code> for bold. The name and email come from the site itself.
      </p>
      <section className="desk-panel glass">
        <h2 className="desk-h2">Top</h2>
        <div className="desk-fields">
          <div className="desk-field">
            <label htmlFor="cv-phone">Phone</label>
            <input id="cv-phone" value={cv.phone} onChange={(e) => put({ phone: e.target.value })} />
          </div>
          <div className="desk-field">
            <label htmlFor="cv-linkedin">LinkedIn address</label>
            <input id="cv-linkedin" value={cv.linkedin} onChange={(e) => put({ linkedin: e.target.value })} placeholder="https://www.linkedin.com/in/…" />
          </div>
          {text("Summary", "summary", 4, "A few lines under the name.")}
          {text("Skills", "skills", 4, "One row per line, the items separated by | (a vertical bar).")}
        </div>
      </section>
      <section className="desk-panel glass">
        <h2 className="desk-h2">Experience</h2>
        <div className="desk-fields cv-jobs" ref={flip}>
          {cv.jobs.map((j, i) => (
            <div className="desk-field cv-job-edit" data-wide="true" key={keyOf(j)}>
              <div className="desk-fields">
                <div className="desk-field">
                  <label htmlFor={`cv-role-${i}`}>Role</label>
                  <input id={`cv-role-${i}`} value={j.role} onChange={(e) => job(i, { role: e.target.value })} />
                </div>
                <div className="desk-field">
                  <label htmlFor={`cv-org-${i}`}>Where</label>
                  <input id={`cv-org-${i}`} value={j.org} onChange={(e) => job(i, { org: e.target.value })} />
                </div>
                <div className="desk-field">
                  <label htmlFor={`cv-when-${i}`}>When</label>
                  <input id={`cv-when-${i}`} value={j.when} onChange={(e) => job(i, { when: e.target.value })} placeholder="04/2023 – present" />
                </div>
                <div className="desk-field" data-wide="true">
                  <label htmlFor={`cv-bullets-${i}`}>What I did</label>
                  <textarea id={`cv-bullets-${i}`} rows={Math.min(18, Math.max(4, j.bullets.split("\n").length + 1))} value={j.bullets} onChange={(e) => job(i, { bullets: e.target.value })} />
                  <p className="desk-help">A line starting &ldquo;- &rdquo; is a bullet; indent it two spaces (&ldquo;  - &rdquo;) to put it inside the one above.</p>
                </div>
              </div>
              <div className="desk-row">
                <button type="button" className="desk-btn desk-quiet" disabled={i === 0} onClick={() => move(i, -1)}>
                  Up
                </button>
                <button type="button" className="desk-btn desk-quiet" disabled={i === cv.jobs.length - 1} onClick={() => move(i, 1)}>
                  Down
                </button>
                <button type="button" className="desk-btn desk-quiet desk-danger" onClick={async () => (await confirmBox(`Remove "${j.role || "this job"}"?`, { yes: "Remove" })) && put({ jobs: cv.jobs.filter((_, k) => k !== i) })}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="desk-btn desk-quiet" onClick={() => put({ jobs: [...cv.jobs, { role: "", org: "", when: "", bullets: "- " }] })}>
          Add a job
        </button>
      </section>
      <section className="desk-panel glass">
        <h2 className="desk-h2">Education and interests</h2>
        <div className="desk-fields">
          {text("Education", "education", 4, "One line each.")}
          {text("Interests", "interests", 3, "One row per line, the items separated by |.")}
        </div>
      </section>
      <div className="desk-bar glass">
        <span className="desk-bar-state mono" data-dirty={dirty}>
          {busy ? "Saving…" : dirty ? "Not saved yet" : "Saved"}
        </span>
        <button type="submit" className="desk-btn desk-main" disabled={busy || !dirty}>
          Save
        </button>
      </div>
    </form>
  );
}

// /admin/score/<piece>: writing a piece's score.
function ScoreScreen({ id }: { id: string }) {
  const toast = useContext(Toast);
  const go = useContext(Nav);
  return (
    <>
      <Head trail={[["Admin", "/admin"], ["Pieces", "/admin/piece"], ["The piece", `/admin/piece/${id}`]]} title="Write the score" />
      <p className="desk-lede">Pick a length, then tap the note. Bar lines, ties and beams look after themselves, and what you see is what the piece&apos;s page will show and play.</p>
      <ScoreEditor id={id} say={toast} onSaved={go} />
    </>
  );
}

// Arrived from the "Edit this page" button on the site, which knows a page by its address, not by the number the admin area keeps it under: look it…
function Find({ kinds, slug }: { kinds: string[]; slug: string }) {
  const router = useRouter();
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      for (const kind of kinds) {
        if (!formFor(kind)) continue;
        const found = (await api.list(kind as Kind).catch(() => [])).find((e) => e.slug === slug);
        if (found) return void (live && router.replace(`/admin/${kind}/${found.id}`));
      }
      if (live) setMissing(true);
    })();
    return () => void (live = false);
  }, [kinds, slug, router]);
  return missing ? <Head trail={[["Admin", "/admin"]]} title="That page is not in the admin area" /> : <p className="desk-help">Finding it…</p>;
}

// "Is there anything to save?" answered by comparing what is on screen with what was last saved, not by remembering that something was touched:…
const shapeOf = (value: unknown) => JSON.stringify(value, (_k, v) => (v === "" || v === null || (Array.isArray(v) && !v.length) ? undefined : v)) ?? "";
function useChanged(value: unknown, ready: boolean) {
  const [base, setBase] = useState<string | null>(null);
  const shape = shapeOf(value);
  // With no baseline (just loaded, or just saved), what is on screen now becomes it.
  useEffect(() => {
    if (base === null && ready) setBase(shape);
  }, [base, ready, shape]);
  const settle = useCallback(() => setBase(null), []);
  return [ready && base !== null && base !== shape, settle] as const;
}

// Keys that are never typed: signing in with the service fetches them.
const FILLED_IN = new Set(["STRAVA_REFRESH_TOKEN", "APPLE_MUSIC_USER_TOKEN"]);
function Connections() {
  const toast = useContext(Toast);
  const [groups, setGroups] = useState<KeyGroup[] | null>(null);
  const [typed, setTyped] = useState<Record<string, string>>({});
  useEffect(() => {
    api.settings().then((r) => setGroups(r.keys), (err) => toast(err.message, true));
  }, [toast]);
  const put = async (keys: Record<string, string>, said: string) => {
    try {
      setGroups((await api.saveSettings({ keys })).keys);
      setTyped((t) => Object.fromEntries(Object.entries(t).filter(([k]) => !(k in keys))));
      toast(said);
    } catch (err) {
      toast((err as Error).message, true);
    }
  };
  const origin = typeof window === "undefined" || !/^https?:/.test(window.location.origin) ? site.url : window.location.origin;
  return (
    <>
      <Head trail={[["Admin", "/admin"]]} title="Connections" />
      <p className="desk-lede">Keys for the other services the site talks to. They are stored encrypted, and once saved they are never shown again, here or anywhere: you can only replace or clear them.</p>
      {!groups && <p className="desk-help">Loading…</p>}
      {groups?.map((g) => {
        const waiting = Object.fromEntries(g.keys.filter((k) => typed[k.name]?.trim()).map((k) => [k.name, typed[k.name]]));
        return (
          <form
            className="desk-panel glass"
            key={g.service}
            onSubmit={(e) => {
              e.preventDefault();
              if (Object.keys(waiting).length) put(waiting, `${g.service} saved.`);
            }}
          >
            <h2 className="desk-h2">{g.service}</h2>
            <p className="desk-help">{g.about}</p>
            <div className="desk-fields">
              {g.keys.map((k) => (
                <div className="desk-field" data-wide="true" key={k.name}>
                  <label htmlFor={`desk-key-${k.name}`}>
                    {k.name} <span className="desk-tag" data-on={k.set}>{k.set ? (k.from === "environment" ? "Set in the .env file" : "Set") : "Not set"}</span>
                  </label>
                  {FILLED_IN.has(k.name) && <p className="desk-help">{k.set ? "Filled in by the Connect button below." : "Leave this alone: the Connect button below fills it in."}</p>}
                  <div className="desk-row" hidden={FILLED_IN.has(k.name) && !k.set}>
                    <input id={`desk-key-${k.name}`} type="password" hidden={FILLED_IN.has(k.name)} autoComplete="off" value={typed[k.name] ?? ""} placeholder={k.set ? "••••••••••••••••   saved (type to replace)" : "Paste the value"} onChange={(e) => setTyped({ ...typed, [k.name]: e.target.value })} />
                    {k.set && k.from !== "environment" && (
                      <button type="button" className="desk-btn desk-quiet" onClick={async () => (await confirmBox(`Clear ${k.name}?`, { yes: "Clear" })) && put({ [k.name]: "" }, `${k.name} cleared.`)}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {g.service === "Apple Music" && <AppleMusicPanel keysSet={g.keys.filter((k) => k.set).length} onToken={(token) => put({ APPLE_MUSIC_USER_TOKEN: token }, "Apple Music connected.")} />}
            {g.service === "Strava" && <StravaPanel origin={origin} keysSet={g.keys.filter((k) => k.set).length} />}
            {g.service === "My phone" && (
              <div className="desk-help">
                <p>To have your phone keep "Where I am" up to date, make a Shortcut with these steps, and an automation that runs it when you arrive somewhere, or once a day:</p>
                <ol>
                  <li>Get Current Location, then Get Details of Location for the city (or state), latitude and longitude.</li>
                  <li>
                    Get Contents of URL: <code>{origin}/api/location</code>, method POST, header <code>Authorization: Bearer your-password</code>, JSON body with <code>name</code>, <code>lat</code>, <code>lon</code> and <code>timeZone</code> (for example America/Los_Angeles).
                  </li>
                </ol>
                <p>The site rounds the position to about ten kilometres before storing it, so it never knows your street.</p>
                <p>
                  <b>By hand, with a message.</b> A second Shortcut can ask you for a line of text and send the same body with two more fields: <code>manual</code> set to true and <code>message</code> (&quot;Here for a wedding&quot;). The place and message then stay put, and the automatic Shortcut is ignored, until you send <code>manual</code> set to false (a third, one-step Shortcut) or untick &quot;Hold this place&quot; in Settings. Add <code>hours</code> (a number) to have it let go by itself.
                </p>
                <p>
                  <b>Away.</b> Send <code>away</code> set to true with a <code>message</code> (&quot;Catching rays, back on Tuesday 14th&quot;) and the home and contact pages say you are away, with that message. The place still follows the automatic Shortcut, so it shows where you have gone. Send <code>away</code> set to false when you are back, or add <code>hours</code> for it to end by itself. Or add <code>back</code>, the day you return (<code>2026-10-14</code>, or a full date and time): the note ends by itself then. No place is needed in the body: <code>away</code> and <code>message</code> alone will do.
                </p>
                <p>
                  <b>Health numbers</b> go to <code>{origin}/api/health</code> with the same header. The measures: <code>vo2max</code>, <code>restingHr</code>, <code>hrv</code>, <code>walkingHr</code>, <code>respiratoryRate</code>, <code>bloodOxygen</code>, <code>sleepHours</code>, <code>steps</code>, <code>exerciseMinutes</code>, <code>activeEnergy</code> (kcal), <code>weight</code> (kg) and <code>bodyFat</code> (%). One value is kept per measure per day; sending the same days again changes nothing. Two ways:
                </p>
                <ol>
                  <li>
                    A Shortcut: Find Health Samples, then for each one a line of text <code>date,value</code> (the date as <code>yyyy-MM-dd</code>), joined with new lines and sent as the body to <code>{origin}/api/health?metric=steps</code>. Years of history can go in one request. JSON works too: <code>metric</code>, <code>date</code>, <code>value</code>, or <code>metric</code> with a list of <code>samples</code>.
                  </li>
                  <li>The Health Auto Export app: add a REST API automation pointing at that address, with the header above and the JSON format. The site understands what it sends.</li>
                </ol>
              </div>
            )}
            <div className="desk-row">
              <button type="submit" className="desk-btn desk-main" disabled={!Object.keys(waiting).length}>
                Save
              </button>
            </div>
          </form>
        );
      })}
      {groups && <PasskeysPanel />}
    </>
  );
}

const ago = (iso?: string) => {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 2 ? "just now" : mins < 90 ? `${mins} minutes ago` : mins < 2880 ? `${Math.round(mins / 60)} hours ago` : `${Math.round(mins / 1440)} days ago`;
};
// Under the Apple Music keys: sign in to Apple once, so the site may read what I last played.
type MusicKitGlobal = { configure: (o: { developerToken: string; app: { name: string; build: string } }) => Promise<unknown>; getInstance: () => { authorize: () => Promise<string>; unauthorize: () => Promise<void> } };
function AppleMusicPanel({ keysSet, onToken }: { keysSet: number; onToken: (token: string) => void }) {
  const toast = useContext(Toast);
  const [status, setStatus] = useState<AppleMusicStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.appleMusic().then(setStatus, () => {}), []);
  useEffect(() => void load(), [load, keysSet]);
  const connect = async () => {
    if (!status?.developerToken) return;
    setBusy(true);
    try {
      const w = window as unknown as { MusicKit?: MusicKitGlobal };
      if (!w.MusicKit) {
        await new Promise<void>((done, fail) => {
          const tag = document.createElement("script");
          tag.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
          tag.async = true;
          tag.onload = () => done();
          tag.onerror = () => fail(new Error("Apple's player script could not be loaded. Check the connection, or a content blocker."));
          document.head.appendChild(tag);
        });
        // The script announces itself a moment after it loads.
        for (let n = 0; n < 50 && !w.MusicKit; n++) await new Promise((r) => window.setTimeout(r, 100));
      }
      if (!w.MusicKit) throw new Error("Apple's player script did not start.");
      await w.MusicKit.configure({ developerToken: status.developerToken, app: { name: "sidneyb.uk", build: "1.0" } });
      const token = await w.MusicKit.getInstance().authorize();
      if (!token) throw new Error("Apple did not give permission.");
      onToken(token);
      window.setTimeout(load, 1500);
    } catch (err) {
      toast((err as Error)?.message || "Apple Music was not connected.", true);
    }
    setBusy(false);
  };
  if (!status) return null;
  return (
    <div className="desk-help">
      {status.error && <p className="desk-error">{status.error}</p>}
      {!status.hasKey && !status.error && <p>Save the Team ID, Key ID and private key first; the Connect button appears after that.</p>}
      {status.hasKey && (
        <p>
          {status.connected
            ? status.works
              ? `Connected.${status.track ? ` Last played: ${status.track.title}, ${status.track.artist}.` : " Nothing played lately."}`
              : `A user token is saved, but Apple refused it${status.status ? ` (${status.status})` : ""}. It lasts about six months: press Connect again.`
            : "The key is saved. Now sign in to Apple so the site may read what you last played."}
        </p>
      )}
      {status.hasKey && (
        <button type="button" className="desk-btn" disabled={busy} onClick={connect}>
          {busy ? "Waiting for Apple…" : status.connected ? "Connect again" : "Connect Apple Music"}
        </button>
      )}
    </div>
  );
}
// Under the Strava keys: connect, and bring activities in.
function StravaPanel({ origin, keysSet }: { origin: string; keysSet: number }) {
  const toast = useContext(Toast);
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => api.strava().then(setStatus, () => {}), []);
  useEffect(() => {
    load();
    // Coming back from Strava, the address says how it went.
    const said = new URLSearchParams(window.location.search).get("strava");
    if (said) {
      toast(said === "connected" ? "Strava is connected. Your activities are being brought in now." : said, said !== "connected");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [load, toast]);
  // Saving the client ID and secret above is what makes Connect possible: look again when they change.
  useEffect(() => void load(), [load, keysSet]);
  const run = async (action: "sync" | "full" | "disconnect", doing: string) => {
    setBusy(doing);
    try {
      const r = await api.stravaDo(action);
      setStatus(r.status);
      toast(action === "disconnect" ? "Disconnected. The activities already brought in are kept." : `Done: ${r.added ?? 0} new, and the full detail of ${r.details ?? 0} more.`);
    } catch (err) {
      toast((err as Error).message, true);
      load();
    }
    setBusy("");
  };
  if (!status) return null;
  return (
    <div className="desk-help desk-strava">
      {!status.connected ? (
        <>
          <p>
            In your Strava API application, set <b>Authorization Callback Domain</b> to <code>{origin.replace(/^https?:\/\//, "").replace(/:\d+$/, "")}</code> (the name only, no port). Then save the client ID and secret above and press Connect. Only activities you have made visible to followers or everyone are brought in; ones marked "Only you" never are.
          </p>
          <div className="desk-row">
            {status.hasApp && api.stravaConnect ? (
              <a className="desk-btn desk-main" href={api.stravaConnect}>
                Connect Strava
              </a>
            ) : (
              <button type="button" className="desk-btn desk-main" disabled>
                Connect Strava
              </button>
            )}
            {!status.hasApp && <span>Save the client ID and client secret first.</span>}
          </div>
        </>
      ) : (
        <>
          <p>
            <span className="desk-tag" data-on="true">Connected</span> {status.athlete ? `as ${status.athlete}. ` : ""}
            {status.activities.toLocaleString("en-GB")} activities brought in ({status.detailed.toLocaleString("en-GB")} with their full detail{status.hidden ? `, ${status.hidden} hidden` : ""}). Last checked {ago(status.lastSync)}.
          </p>
          {status.error && <p className="desk-error">The last check stopped: {status.error}</p>}
          <p>The site checks for new activities by itself every 15 minutes, whether or not anyone is visiting. Splits and best efforts cost Strava one request per activity and Strava rations those (about 100 every 15 minutes, 1,000 a day), so a long history fills in 70 at a time: a thousand activities take most of a day. Everything else about an activity is there from the first check.</p>
          <div className="desk-row">
            <button type="button" className="desk-btn desk-main" disabled={!!busy || status.running} onClick={() => run("sync", "Checking…")}>
              {busy === "Checking…" || status.running ? "Checking…" : "Check now"}
            </button>
            <button type="button" className="desk-btn" disabled={!!busy} onClick={async () => (await confirmBox("Read your whole Strava history again? Anything deleted on Strava is removed here too.", { yes: "Import", danger: false })) && run("full", "Importing…")}>
              {busy === "Importing…" ? "Importing…" : "Import everything again"}
            </button>
            <button type="button" className="desk-btn desk-quiet" disabled={!!busy} onClick={async () => (await confirmBox("Disconnect Strava?", { yes: "Disconnect" })) && run("disconnect", "…")}>
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Every activity brought in from Strava, with a switch to keep one off the site.
const KIND_TABS: [string, string][] = [["", "All"], ["run", "Runs"], ["ride", "Rides"], ["gym", "Gym"], ["padel", "Padel"]];
// "32:15" or "1:02:30" as seconds.
const seconds = (text: string) => {
  const parts = text.trim().split(":").map(Number);
  if (!text.trim() || parts.some((n) => !Number.isFinite(n))) return 0;
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 60;
};
function ActivitiesScreen() {
  const toast = useContext(Toast);
  const go = useContext(Nav);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [items, setItems] = useState<AdminActivity[]>([]);
  const [found, setFound] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [fresh, setFresh] = useState({ date: today(), sport: "Run", time: "", km: "", hr: "" });
  const load = useCallback((offset: number, live: () => boolean = () => true) => api.activities(q, offset, kind).then((r) => live() && (setFound(r.total), setItems((was) => (offset ? [...was, ...r.items] : r.items))), (err) => toast((err as Error).message, true)), [q, kind, toast]);
  useEffect(() => {
    let on = true;
    const wait = window.setTimeout(() => load(0, () => on), q ? 250 : 0);
    return () => {
      on = false;
      window.clearTimeout(wait);
    };
  }, [load, q]);
  // The spreadsheet the run log began as: offered until its runs are in.
  const [sheet, setSheet] = useState<{ spreadsheet: number; byHand: number } | null>(null);
  const [bringing, setBringing] = useState(false);
  useEffect(() => void api.runLog().then(setSheet, () => {}), []);
  const bringIn = async () => {
    setBringing(true);
    try {
      const r = await api.importRunLog();
      toast(r.added ? `Brought in ${r.added} runs.` : "They were all in already.");
      setSheet(await api.runLog());
      load(0);
    } catch (err) {
      toast((err as Error).message, true);
    }
    setBringing(false);
  };
  const add = async () => {
    try {
      const { id } = await api.addActivity({ date: fresh.date, sport: fresh.sport, time: seconds(fresh.time), km: Number(fresh.km.replace(",", ".")) || 0, hr: Number(fresh.hr) || undefined });
      go(`/admin/activities/${id}`);
    } catch (err) {
      toast((err as Error).message, true);
    }
  };
  return (
    <>
      <Head trail={[["Admin", "/admin"]]} title="Training">
        <button type="button" className="desk-btn" onClick={() => setAdding(!adding)}>
          Add by hand
        </button>
      </Head>
      <p className="desk-lede">
        Whatever your watch records reaches Strava and then arrives here by itself. Open one to add what the watch does not know: the kind of run, the weights, the score, how it felt, a note, pictures.{api.demo ? " In the preview the runs are from your spreadsheet and the rest are samples." : ""}
      </p>
      {sheet && sheet.spreadsheet > 0 && sheet.byHand === 0 && (
        <div className="desk-offer glass">
          <div>
            <b>Your old run spreadsheet</b>
            <p>{sheet.spreadsheet} runs with their types, notes and best times are ready to bring in. Ones Strava also has are joined to Strava's, not doubled.</p>
          </div>
          <button type="button" className="desk-btn" disabled={bringing} onClick={bringIn}>
            {bringing ? "Bringing them in…" : "Bring them in"}
          </button>
        </div>
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add something by hand">
        <Tabs className="sheet-kinds" label="What was it">
          {([["Run", "Run"], ["Ride", "Ride"], ["WeightTraining", "Gym"], ["Padel", "Padel"], ["Workout", "Other"]] as const).map(([v, name]) => (
            <button key={v} type="button" aria-pressed={fresh.sport === v} onClick={() => setFresh({ ...fresh, sport: v })}>
              {name}
            </button>
          ))}
        </Tabs>
        <div className="sheet-grid">
          <label>
            <span className="mono">Date</span>
            <DateField value={fresh.date} clearable={false} onChange={(v) => setFresh({ ...fresh, date: v })} />
          </label>
          <label>
            <span className="mono">Time taken</span>
            <input inputMode="numeric" placeholder="29:48" value={fresh.time} onChange={(e) => setFresh({ ...fresh, time: e.target.value })} />
          </label>
          <label>
            <span className="mono">Heart rate</span>
            <input inputMode="numeric" placeholder="158" value={fresh.hr} onChange={(e) => setFresh({ ...fresh, hr: e.target.value })} />
          </label>
          <Reveal pop show={fresh.sport === "Run" || fresh.sport === "Ride"}>
            {() => (
              <label>
                <span className="mono">Distance, km</span>
                <input inputMode="decimal" placeholder={fresh.sport === "Ride" ? "32.4" : "5.03"} value={fresh.km} onChange={(e) => setFresh({ ...fresh, km: e.target.value })} />
              </label>
            )}
          </Reveal>
        </div>
        <div className="sheet-foot">
          <button type="button" className="sheet-link" onClick={() => setAdding(false)}>
            Cancel
          </button>
          <button type="button" className="desk-btn desk-main" disabled={!fresh.date || !seconds(fresh.time) || (fresh.sport === "Run" && !Number(fresh.km.replace(",", ".")))} onClick={add}>
            Add it
          </button>
        </div>
      </Sheet>
      <div className="tr-filter">
        <Tabs className="tr-tabs" cols={5} label="Which activities">
          {KIND_TABS.map(([k, name]) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {name}
            </button>
          ))}
        </Tabs>
        <input className="desk-find" type="search" placeholder="Search by name, sport or date" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {found === 0 && <p className="desk-help">{q || kind ? "Nothing matches." : "Nothing has arrived yet. Connect Strava under Connections, or add something by hand."}</p>}
      <ul className="desk-entries">
        {items.map((a) => (
          <li key={a.id} className="desk-entry glass" data-hidden={a.hidden}>
            <Go href={`/admin/activities/${a.id}`} className="desk-entry-main">
              <strong>
                {a.name && a.name !== "Run" ? a.name : KIND_NAMES[a.kind] === "Something else" ? sportName(a.sport) : KIND_NAMES[a.kind]}
                {markOf(a.kind, a.log, typeName) && <i className="tr-mark">{markOf(a.kind, a.log, typeName)}</i>}
              </strong>
              <span>
                {dayOf(a.start_local)}
                {a.distance >= 50 ? ` · ${dist(a.distance, "km")}` : ""} · {clock(a.moving)}
                {a.hidden ? " · hidden" : ""}
              </span>
            </Go>
            <span className="tr-state mono" data-done={writtenUp(a.log)}>
              {writtenUp(a.log) ? "Written up" : "To write up"}
            </span>
          </li>
        ))}
      </ul>
      {found !== null && items.length < found && (
        <div className="desk-row">
          <button type="button" className="desk-btn" onClick={() => load(items.length)}>
            Earlier ones
          </button>
        </div>
      )}
    </>
  );
}

// One set of padel in two taps: who won it, and how many games the losers got.
function SetRow({ set, n, onChange, onRemove }: { set: [number, number]; n: number; onChange: (s: [number, number]) => void; onRemove: () => void }) {
  const won = set[0] >= set[1];
  const loser = Math.min(set[0], set[1]);
  const make = (weWon: boolean, games: number): [number, number] => {
    const top = games >= 5 ? 7 : 6;
    return weWon ? [top, games] : [games, top];
  };
  return (
    <div className="pdl-set">
      <span className="mono">Set {n}</span>
      <Tabs className="tr-tabs pdl-who" label={`Who won set ${n}`}>
        <button type="button" aria-pressed={won} onClick={() => onChange(make(true, loser))}>
          We won
        </button>
        <button type="button" aria-pressed={!won} onClick={() => onChange(make(false, loser))}>
          They won
        </button>
      </Tabs>
      <div className="pdl-games" role="group" aria-label={`Games the losing side won in set ${n}`}>
        {[0, 1, 2, 3, 4, 5, 6].map((g) => (
          <button key={g} type="button" aria-pressed={loser === g} onClick={() => onChange(make(won, g))}>
            {g}
          </button>
        ))}
      </div>
      <b className="pdl-score">
        {set[0]}-{set[1]}
      </b>
      <button type="button" className="pdl-x" onClick={onRemove} aria-label={`Remove set ${n}`}>
        ×
      </button>
    </div>
  );
}

// /admin/activities/<id>: one activity, and everything I can add to it.
function ActivityEditor({ id }: { id: string }) {
  const toast = useContext(Toast);
  const go = useContext(Nav);
  const router = useRouter();
  const [a, setA] = useState<AdminActivity | null>(null);
  const [log, setLog] = useState<ActivityLog>({});
  const [state, setState] = useState<"" | "saving" | "saved">("");
  const [busy, setBusy] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  useEffect(() => void api.activity(id).then((x) => (setA(x), setLog(x.log)), (err) => toast((err as Error).message, true)), [id, toast]);
  // Everything saves as it is changed: there is no Save button to forget.
  const put = async (next: ActivityLog) => {
    setLog(next);
    setState("saving");
    try {
      await api.saveLog(id, next);
      setState("saved");
      router.refresh();
    } catch (err) {
      setState("");
      toast((err as Error).message, true);
    }
  };
  if (!a) return <Head trail={[["Admin", "/admin"], ["Training", "/admin/activities"]]} title="…" />;
  const kind = log.as ?? a.kind;
  const day = a.start_local.slice(0, 10);
  const padel = log.padel ?? {};
  const sets = padel.sets ?? [];
  const result = padelResult(sets);
  const blur = <K extends keyof ActivityLog>(key: K, was: string) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => e.target.value.trim() !== was && put({ ...log, [key]: e.target.value.trim() || undefined });
  const upload = async (files: File[]) => {
    setBusy(true);
    const added: { src: string }[] = [];
    for (const f of files) {
      try {
        added.push({ src: (await api.upload(f)).url });
      } catch (err) {
        toast((err as Error).message, true);
      }
    }
    setBusy(false);
    if (added.length) put({ ...log, media: [...(log.media ?? []), ...added] });
  };
  const pace = a.distance >= 50 && a.moving ? clock(a.moving / (a.distance / 1000)) : "";
  return (
    <>
      <Head trail={[["Admin", "/admin"], ["Training", "/admin/activities"]]} title={a.name && a.name !== "Run" ? a.name : KIND_NAMES[kind]}>
        <i className="tr-saved mono" aria-live="polite">
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : ""}
        </i>
      </Head>
      <p className="tr-facts mono">
        {dayOf(a.start_local)}
        {a.distance >= 50 ? ` · ${dist(a.distance, "km")}` : ""} · {clock(a.moving)}
        {pace && kind === "run" ? ` · ${pace} /km` : ""}
        {a.hr ? ` · ${Math.round(a.hr)} bpm` : ""}
        {a.id.startsWith("-") ? " · typed in" : " · from Strava"}
      </p>

      <section className="tr-box glass">
        <h2 className="desk-h2">What was it?</h2>
        <Tabs className="tr-tabs" cols={5} label="What kind of activity">
          {(Object.keys(KIND_NAMES) as (keyof typeof KIND_NAMES)[]).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => put({ ...log, as: k === a.kind && !log.as ? undefined : k })}>
              {k === "other" ? "Other" : KIND_NAMES[k]}
            </button>
          ))}
        </Tabs>
        <p className="desk-help">Worked out from Strava. Change it if Strava got it wrong, and the right questions appear below.</p>
      </section>

      <Reveal show={kind === "run"}>
        {() => (
        <section className="tr-box glass">
          <h2 className="desk-h2">The run</h2>
          <div className="rla-types" role="group" aria-label="What kind of run">
            <Pill />
            {TYPES.map(([letter, name]) => (
              <button key={letter} type="button" aria-pressed={log.type === letter} onClick={() => put({ ...log, type: log.type === letter ? undefined : letter })}>
                <b>{letter}</b>
                {name}
              </button>
            ))}
          </div>
          <div className="rla-extra">
            <label>
              <span className="mono">Cadence{a.has?.cadence ? " (Strava has one; this replaces it)" : ""}</span>
              <input type="number" inputMode="numeric" placeholder="160" defaultValue={log.cadence ?? ""} onBlur={(e) => Number(e.target.value) !== (log.cadence ?? 0) && put({ ...log, cadence: Number(e.target.value) || undefined })} />
            </label>
            {!a.has?.hr && (
              <label>
                <span className="mono">Heart rate</span>
                <input type="number" inputMode="numeric" placeholder="158" defaultValue={log.hr ?? ""} onBlur={(e) => Number(e.target.value) !== (log.hr ?? 0) && put({ ...log, hr: Number(e.target.value) || undefined })} />
              </label>
            )}
            <label>
              <span className="mono">Best times in it</span>
              <input placeholder="24:48 (5K)" defaultValue={log.efforts ?? ""} onBlur={blur("efforts", log.efforts ?? "")} />
            </label>
          </div>
        </section>
        )}
      </Reveal>

      <Reveal show={kind === "ride"}>
        {() => (
        <section className="tr-box glass">
          <h2 className="desk-h2">The ride</h2>
          <Tabs className="tr-tabs" cols={4} label="What sort of ride">
            {RIDE_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={log.ride?.kind === k} onClick={() => put({ ...log, ride: { ...log.ride, kind: log.ride?.kind === k ? undefined : k } })}>
                {k}
              </button>
            ))}
          </Tabs>
          <div className="rla-extra">
            <label>
              <span className="mono">Which bike</span>
              <input placeholder="Road bike" defaultValue={log.ride?.bike ?? ""} onBlur={(e) => e.target.value.trim() !== (log.ride?.bike ?? "") && put({ ...log, ride: { ...log.ride, bike: e.target.value.trim() || undefined } })} />
            </label>
            <label>
              <span className="mono">Who with</span>
              <input placeholder="On my own" defaultValue={log.ride?.with ?? ""} onBlur={(e) => e.target.value.trim() !== (log.ride?.with ?? "") && put({ ...log, ride: { ...log.ride, with: e.target.value.trim() || undefined } })} />
            </label>
            {!a.has?.hr && (
              <label>
                <span className="mono">Heart rate</span>
                <input type="number" inputMode="numeric" placeholder="140" defaultValue={log.hr ?? ""} onBlur={(e) => Number(e.target.value) !== (log.hr ?? 0) && put({ ...log, hr: Number(e.target.value) || undefined })} />
              </label>
            )}
          </div>
        </section>
        )}
      </Reveal>

      <Reveal show={kind === "gym"}>
        {() => (
        <section className="tr-box glass">
          <h2 className="desk-h2">What you lifted</h2>
          <p className="desk-help">Tap Done on each machine you used. If the weight went up, tap + first.</p>
          <GymBoard day={day} />
        </section>
        )}
      </Reveal>

      <Reveal show={kind === "padel"}>
        {() => (
        <section className="tr-box glass">
          <h2 className="desk-h2">The padel</h2>
          <Tabs className="tr-tabs" cols={3} label="What kind of session">
            {PADEL_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={padel.kind === k} onClick={() => put({ ...log, padel: { ...padel, kind: padel.kind === k ? undefined : k } })}>
                {k}
              </button>
            ))}
          </Tabs>
          <Reveal show={padel.kind !== "Training"}>
            {() => (
            <div className="tr-fold">
              {sets.map((set, n) => (
                <SetRow key={n} n={n + 1} set={set} onChange={(next) => put({ ...log, padel: { ...padel, sets: sets.map((x, k) => (k === n ? next : x)) } })} onRemove={() => put({ ...log, padel: { ...padel, sets: sets.filter((_, k) => k !== n) } })} />
              ))}
              <div className="desk-row">
                <button type="button" className="desk-btn" onClick={() => put({ ...log, padel: { ...padel, sets: [...sets, [6, 4]] } })}>
                  Add a set
                </button>
                {result && (
                  <b className="pdl-result" data-outcome={result}>
                    {result === "won" ? "Won" : result === "lost" ? "Lost" : "Level"} {scoreOf(sets)}
                  </b>
                )}
              </div>
            </div>
            )}
          </Reveal>
          <div className="rla-extra">
            <label>
              <span className="mono">Played with</span>
              <input placeholder="Partner" defaultValue={padel.partner ?? ""} onBlur={(e) => e.target.value.trim() !== (padel.partner ?? "") && put({ ...log, padel: { ...padel, partner: e.target.value.trim() || undefined } })} />
            </label>
            <label>
              <span className="mono">Against</span>
              <input placeholder="Opponents" defaultValue={padel.opponents ?? ""} onBlur={(e) => e.target.value.trim() !== (padel.opponents ?? "") && put({ ...log, padel: { ...padel, opponents: e.target.value.trim() || undefined } })} />
            </label>
          </div>
          <Tabs className="tr-tabs" cols={2} label="Which side you played">
            {["Left", "Right"].map((side) => (
              <button key={side} type="button" aria-pressed={padel.side === side} onClick={() => put({ ...log, padel: { ...padel, side: padel.side === side ? undefined : side } })}>
                {side} side
              </button>
            ))}
          </Tabs>
        </section>
        )}
      </Reveal>

      <section className="tr-box glass">
        <h2 className="desk-h2">How it went</h2>
        <div className="rla-feel" role="group" aria-label="How it felt">
          <Pill />
          <span className="mono">Felt</span>
          {FEELS.map((name, k) => (
            <button key={name} type="button" aria-pressed={log.feel === k + 1} onClick={() => put({ ...log, feel: log.feel === k + 1 ? undefined : k + 1 })}>
              {name}
            </button>
          ))}
        </div>
        <textarea rows={3} placeholder="Anything worth remembering" defaultValue={log.note ?? ""} onBlur={blur("note", log.note ?? "")} aria-label="Notes" />
      </section>

      <section className="tr-box glass">
        <h2 className="desk-h2">Pictures and videos</h2>
        <div className="tr-media">
          {(log.media ?? []).map((m, n) => (
            <figure key={m.src.slice(-40) + n}>
              {isImage(m.src) || m.src.startsWith("data:image") ? <img src={m.src} alt="" /> : <video src={m.src} muted playsInline preload="metadata" />}
              <input placeholder="Caption" defaultValue={m.caption ?? ""} onBlur={(e) => e.target.value.trim() !== (m.caption ?? "") && put({ ...log, media: (log.media ?? []).map((x, k) => (k === n ? { ...x, caption: e.target.value.trim() || undefined } : x)) })} />
              <button type="button" onClick={() => put({ ...log, media: (log.media ?? []).filter((_, k) => k !== n) })} aria-label="Remove">
                ×
              </button>
            </figure>
          ))}
        </div>
        <button type="button" className="desk-btn" disabled={busy} onClick={() => pick.current?.click()}>
          {busy ? "Uploading…" : "Add pictures or videos"}
        </button>
        <input ref={pick} type="file" hidden multiple accept="image/*,video/*" onChange={(e) => (upload([...(e.target.files ?? [])]), (e.target.value = ""))} />
      </section>

      <section className="tr-box glass">
        <h2 className="desk-h2">Anything else</h2>
        <p className="desk-help">Your own facts, named however you like: shoes, court, weather, who you ran with.</p>
        {(log.extras ?? []).map((x, n) => (
          <div key={n} className="tr-extra">
            <input defaultValue={x.label} placeholder="Shoes" onBlur={(e) => e.target.value !== x.label && put({ ...log, extras: (log.extras ?? []).map((y, k) => (k === n ? { ...y, label: e.target.value } : y)) })} aria-label="Name" />
            <input defaultValue={x.value} placeholder="Pegasus 41" onBlur={(e) => e.target.value !== x.value && put({ ...log, extras: (log.extras ?? []).map((y, k) => (k === n ? { ...y, value: e.target.value } : y)) })} aria-label="Value" />
            <button type="button" onClick={() => put({ ...log, extras: (log.extras ?? []).filter((_, k) => k !== n) })} aria-label="Remove">
              ×
            </button>
          </div>
        ))}
        <NewExtra onAdd={(label, value) => put({ ...log, extras: [...(log.extras ?? []), { label, value }] })} />
      </section>

      <div className="desk-row tr-end">
        <Go href={`/sport/activities/${a.id}`} className="desk-btn">
          See it on the site
        </Go>
        <button
          type="button"
          className="desk-btn desk-quiet"
          onClick={async () => {
            try {
              await api.hideActivity(a.id, !a.hidden);
              setA({ ...a, hidden: !a.hidden });
              router.refresh();
            } catch (err) {
              toast((err as Error).message, true);
            }
          }}
        >
          {a.hidden ? "Show it on the site" : "Hide it from the site"}
        </button>
        {a.id.startsWith("-") && (
          <button
            type="button"
            className="desk-btn desk-danger"
            onClick={async () => {
              if (!(await confirmBox("Delete this for good?"))) return;
              try {
                await api.removeActivity(a.id);
                toast("Activity deleted.");
                go("/admin/activities");
              } catch (err) {
                toast((err as Error).message, true);
              }
            }}
          >
            Delete
          </button>
        )}
      </div>
    </>
  );
}
function NewExtra({ onAdd }: { onAdd: (label: string, value: string) => void }) {
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const add = () => {
    if (!label.trim() || !value.trim()) return;
    onAdd(label.trim(), value.trim());
    setLabel("");
    setValue("");
  };
  return (
    <div className="tr-extra">
      <input value={label} placeholder="What" onChange={(e) => setLabel(e.target.value)} aria-label="A new fact's name" />
      <input value={value} placeholder="Its value" onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} aria-label="A new fact's value" />
      <button type="button" disabled={!label.trim() || !value.trim()} onClick={add} aria-label="Add">
        +
      </button>
    </div>
  );
}

// ---- The gym: built for one thumb, between sets ---- Each machine shows the weight it was last done at.
function GymBoard({ day }: { day: string }) {
  const toast = useContext(Toast);
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [pending, setPending] = useState<Record<string, string>>({}); // a weight chosen but not yet logged
  const [open, setOpen] = useState("");
  const [name, setName] = useState("");
  useEffect(() => void api.list("lift").then(setEntries, (err) => toast((err as Error).message, true)), [toast]);
  const liftOf = (e: Entry) => ({ slug: e.slug, ...(e.data as Omit<Lift, "slug">), log: Array.isArray(e.data.log) ? (e.data.log as Lift["log"]) : [] }) as Lift;
  const store = async (e: Entry, lift: Lift) => {
    const { slug: _slug, ...data } = lift;
    // Shown at once; put back if the save fails.
    setEntries((was) => (was ?? []).map((x) => (x.id === e.id ? { ...x, data } : x)));
    try {
      await api.save("lift", { id: e.id, slug: e.slug, data, published: e.published, position: e.position });
      router.refresh();
    } catch (err) {
      setEntries((was) => (was ?? []).map((x) => (x.id === e.id ? e : x)));
      toast((err as Error).message, true);
    }
  };
  const add = async () => {
    const title = name.trim();
    if (!title) return;
    try {
      const made = await api.save("lift", { slug: slugify(title), data: { title, unit: "kg", step: 2.5, note: "", log: [] }, published: true, position: (entries ?? []).length });
      setEntries((was) => [...(was ?? []), made]);
      setName("");
      setOpen(made.id);
      router.refresh();
    } catch (err) {
      toast((err as Error).message, true);
    }
  };
  return (
    <>
      {!entries && <p className="desk-help">Loading…</p>}
      <ul className="gyl">
        {(entries ?? []).map((e) => {
          const lift = liftOf(e);
          const last = lastOf(lift);
          const todays = lift.log.find((x) => x.date === day);
          const value = pending[e.id] ?? todays?.value ?? last?.value ?? lift.start ?? "";
          const n = numberOf(value);
          // Changing the weight after it is done today changes today's entry; before, it only sets what Done will log.
          const set = (v: string) => (todays ? store(e, logged(lift, day, v)) : setPending({ ...pending, [e.id]: v }));
          const bump = (by: number) => set(String(Math.max(0, Math.round(((n ?? 0) + by) * 100) / 100)));
          return (
            <li key={e.id} className="gyl-item glass" data-done={!!todays}>
              <div className="gyl-top">
                <button type="button" className="gyl-name" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? "" : e.id)}>
                  <strong>{lift.title}</strong>
                  <span className="mono">{todays ? (day === today() ? "Done today" : "Done that day") : last ? `Last: ${sayLift(lift, last.value)}${last.date ? `, ${dayOf(last.date).replace(/ \d{4}$/, "")}` : ""}` : "Not done yet"}</span>
                </button>
                <button
                  type="button"
                  className="gyl-done"
                  aria-pressed={!!todays}
                  aria-label={todays ? `Undo ${lift.title} for today` : `Log ${lift.title} at ${sayLift(lift, value)}`}
                  disabled={!todays && !value}
                  onClick={() => {
                    setPending(({ [e.id]: _gone, ...rest }) => rest);
                    store(e, todays ? unlogged(lift, day) : logged(lift, day, value));
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.500l4.500 4.500L19 7.500" />
                  </svg>
                  {todays ? "Done" : "Done?"}
                </button>
              </div>
              {counted(lift) ? (
                <div className="gyl-weight">
                  <button type="button" onClick={() => bump(-(lift.step || 2.5))} aria-label={`${lift.step || 2.5} ${lift.unit} less`}>
                    −
                  </button>
                  <label>
                    <input inputMode="decimal" value={value} onChange={(ev) => setPending({ ...pending, [e.id]: ev.target.value.replace(",", ".") })} onBlur={() => todays && pending[e.id] !== undefined && (store(e, logged(lift, day, pending[e.id])), setPending(({ [e.id]: _gone, ...rest }) => rest))} aria-label={`${lift.title}, ${lift.unit}`} />
                    <span>{lift.unit}</span>
                  </label>
                  <button type="button" onClick={() => bump(lift.step || 2.5)} aria-label={`${lift.step || 2.5} ${lift.unit} more`}>
                    +
                  </button>
                </div>
              ) : (
                <input className="gyl-words" value={value} placeholder="What you did" onChange={(ev) => setPending({ ...pending, [e.id]: ev.target.value })} onBlur={() => todays && pending[e.id] !== undefined && (store(e, logged(lift, day, pending[e.id])), setPending(({ [e.id]: _gone, ...rest }) => rest))} aria-label={lift.title} />
              )}
              {open === e.id && (
                <div className="gyl-more">
                  <label>
                    <span className="mono">A line about it</span>
                    <input defaultValue={lift.note ?? ""} placeholder="Maxed out, seat on 4…" onBlur={(ev) => ev.target.value !== (lift.note ?? "") && store(e, { ...lift, note: ev.target.value })} />
                  </label>
                  <p className="gyl-history mono">
                    {lift.log.filter((x) => x.date).length ? lift.log.filter((x) => x.date).map((x) => x.value).join(" → ") : "Nothing logged yet"}
                    {counted(lift) && lift.log.some((x) => x.date) ? ` ${lift.unit}` : ""}
                  </p>
                  <Go href={`/admin/lift/${e.id}`} className="desk-btn desk-quiet">
                    Unit, step, dates, delete
                  </Go>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="gyl-add glass">
        <input value={name} placeholder="Add a machine" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} aria-label="A new machine or exercise" />
        <button type="button" className="desk-btn desk-main" disabled={!name.trim()} onClick={add}>
          Add
        </button>
      </div>
    </>
  );
}

// ---- Cards --------------------------------------------------------------------------------------------------------- One screen for a topic's…
type CardRow = [string, string, string?];
const rowsOf = (data: Record<string, unknown>): CardRow[] => (Array.isArray(data.cards) ? (data.cards as unknown[]).filter((c): c is string[] => Array.isArray(c) && c.length >= 2).map((c) => [String(c[0]), String(c[1]), c[2] ? String(c[2]) : undefined]) : []);
const packed = (rows: CardRow[]) => rows.map(([f, b, g]) => (g ? [f, b, g] : [f, b]));
function CardsScreen({ topic }: { topic: string }) {
  const toast = useContext(Toast);
  const go = useContext(Nav);
  const [topics, setTopics] = useState<Entry[] | null>(null);
  const [subjects, setSubjects] = useState<Entry[]>([]);
  const [group, setGroup] = useState<string | null>(null); // null: every group. "": the cards in no group
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [into, setInto] = useState("");
  const [many, setMany] = useState(false);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(-1); // the card whose extra choices are showing
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    api.list("topic").then(setTopics, (err) => toast(err.message, true));
    api.list("subject").then(setSubjects, () => {});
  }, [toast]);
  const at = topics?.find((t) => t.slug === topic || t.id === topic) ?? null;
  const rows = useMemo(() => (at ? rowsOf(at.data) : []), [at]);
  const groups = useMemo(() => [...new Set(rows.map((r) => r[2] ?? "").filter(Boolean))], [rows]);
  const loose = rows.filter((r) => !r[2]).length;

  // Stores a topic's cards, and shows the stored result.
  const store = async (entry: Entry, next: CardRow[]) => {
    const saved = await api.save("topic", { id: entry.id, slug: entry.slug, data: { ...entry.data, cards: packed(next) }, published: entry.published, position: entry.position });
    setTopics((list) => (list ?? []).map((t) => (t.id === saved.id ? saved : t)));
    return saved;
  };
  const change = async (next: CardRow[], said?: string) => {
    if (!at) return;
    setBusy(true);
    try {
      await store(at, next);
      if (said) toast(said);
    } catch (err) {
      toast((err as Error).message, true);
    }
    setBusy(false);
  };
  const same = (a: CardRow, b: CardRow) => a[0].trim().toLowerCase() === b[0].trim().toLowerCase() && a[1].trim().toLowerCase() === b[1].trim().toLowerCase();
  const add = async () => {
    const f = front.trim(), b = back.trim(), g = into.trim() || undefined;
    if (!f || !b) return first.current?.focus();
    if (rows.some((r) => same(r, [f, b]))) return toast("That card is already in this topic.", true);
    setFront("");
    setBack("");
    first.current?.focus();
    await change([...rows, [f, b, g]]);
  };
  const found = useMemo(() => cardsFrom(pasted, into.trim()).map((c): CardRow => [c[0], c[1], c[2]]), [pasted, into]);
  const addMany = async () => {
    const fresh = found.filter((c, n) => !rows.some((r) => same(r, c)) && found.findIndex((x) => same(x, c)) === n);
    if (!fresh.length) return toast("Nothing new in there.", true);
    await change([...rows, ...fresh], `Added ${fresh.length} ${fresh.length === 1 ? "card" : "cards"}.`);
    setPasted("");
    setMany(false);
  };
  const edit = (n: number, side: 0 | 1, value: string) => {
    const v = value.trim();
    if (!v || v === rows[n][side]) return;
    change(rows.map((r, k) => (k === n ? (side === 0 ? [v, r[1], r[2]] : [r[0], v, r[2]]) : r)));
  };
  const NEW = "\u0000new";
  const named = async (to: string) => (to === NEW ? ((await textBox("Name the new group", "", "Make it")) ?? "").trim() : to);
  // The card stays exactly where it is in the list: only its label changes.
  const regroup = async (n: number, to: string) => {
    const g = await named(to);
    if (to === NEW && !g) return;
    change(rows.map((r, k) => (k === n ? [r[0], r[1], g || undefined] : r)), g ? `“${rows[n][0]}” is in ${g} now.` : `“${rows[n][0]}” is in no group now.`);
  };
  const rename = async (was: string) => {
    const name = ((await textBox(`Rename "${was}" to`, was, "Rename")) ?? "").trim();
    if (!name || name === was) return;
    change(rows.map((r) => (r[2] === was ? [r[0], r[1], name] : r)), "Renamed.");
    if (group === was) setGroup(name);
    if (into === was) setInto(name);
  };
  // Takes cards out of this topic and puts them at the end of another.
  const move = async (which: (r: CardRow, n: number) => boolean, toId: string) => {
    const to = topics?.find((t) => t.id === toId);
    if (!at || !to) return;
    const going = rows.filter(which), staying = rows.filter((r, n) => !which(r, n));
    if (!going.length) return;
    setBusy(true);
    try {
      const there = rowsOf(to.data);
      await store(to, [...there, ...going.filter((c) => !there.some((r) => same(r, c)))]);
      await store(at, staying);
      toast(`Moved ${going.length} to ${to.title}.`);
    } catch (err) {
      toast((err as Error).message, true);
    }
    setBusy(false);
  };
  const subjectName = (slug: unknown) => subjects.find((s) => s.slug === slug)?.title ?? String(slug ?? "");
  const others = (topics ?? []).filter((t) => t.id !== at?.id);
  const shown = rows.map((r, n) => [r, n] as const).filter(([r]) => group === null || (r[2] ?? "") === group);
  const groupOptions = [["", "No group"] as const, ...groups.map((g) => [g, g] as const), [NEW, "New group…"] as const];
  const topicOptions = [["", "Move to…"] as const, ...others.map((t) => [t.id, t.title] as const)];

  return (
    <>
      <Head trail={[["Admin", "/admin"]]} title="Cards">
        {at && (
          <Go className="desk-btn desk-quiet" href={`/learning/${String(at.data.subject ?? "")}/${at.slug}`}>
            See the deck
          </Go>
        )}
      </Head>
      {!topics && <p className="desk-help">Loading…</p>}
      {topics && at && (
        <div className="cd-pick">
          <Pick
            label="Topic"
            value={at?.id ?? ""}
            options={[...(at ? [] : [["", "Choose one"] as const]), ...topics.map((t) => [t.id, `${t.title} · ${subjectName(t.data.subject)} (${rowsOf(t.data).length})`] as const)]}
            onChange={(v) => (setGroup(null), setInto(""), setOpen(-1), go(`/admin/cards/${topics.find((t) => t.id === v)?.slug ?? ""}`))}
          />
        </div>
      )}
      {topics && !at && (
        <>
          <p className="desk-lede">{topic ? "That topic is not there. Here are the ones that are." : "Flashcards live in a topic. Which one?"}</p>
          {subjects
            .map((sub) => [sub, topics.filter((t) => t.data.subject === sub.slug)] as const)
            .filter(([, list]) => list.length)
            .map(([sub, list]) => (
              <section className="dash-block" key={sub.id}>
                <h2 className="mono">{sub.title}</h2>
                <div className="dash-tiles">
                  {list.map((t) => (
                    <Go key={t.id} href={`/admin/cards/${t.slug}`} className="dash-tile glass">
                      <b>{t.title}</b>
                      <span>{rowsOf(t.data).length || "none"}</span>
                    </Go>
                  ))}
                </div>
              </section>
            ))}
          {topics.length === 0 && (
            <p className="desk-help">
              There are no topics yet. <Go href="/admin/topic/new">Make one</Go> first.
            </p>
          )}
        </>
      )}
      {at && (
        <>
          <form
            className="cd-add glass"
            onSubmit={(e) => {
              e.preventDefault();
              if (!many) add();
            }}
          >
            <div className="cd-add-top">
              <b>Add a card</b>
              <button type="button" className="cd-link" onClick={() => setMany(true)}>
                Paste a list
              </button>
            </div>
            <Sheet open={many} onClose={() => setMany(false)} title="Paste a list">
              <textarea className="sheet-area" rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={"Labas - Hello\nAčiū - Thank you\nPrašau - Please"} aria-label="Cards, one a line" autoFocus />
              <p className="sheet-sub">One card a line, the two sides parted by a tab, a dash with spaces round it, <code>=</code> or a colon.{into ? ` They go into ${into}.` : ""}</p>
              <div className="sheet-foot">
                <button type="button" className="sheet-link" onClick={() => setMany(false)}>
                  Cancel
                </button>
                <button type="button" className="desk-btn desk-main" disabled={busy || !found.length} onClick={addMany}>
                  {found.length ? `Add ${found.length} ${found.length === 1 ? "card" : "cards"}` : "Add"}
                </button>
              </div>
            </Sheet>
            {(
              <div className="cd-pair">
                <input ref={first} value={front} onChange={(e) => setFront(e.target.value)} placeholder="Front" aria-label="Front" autoFocus autoComplete="off" autoCapitalize="off" lang={String(at.data.voice ?? "") || undefined} />
                <input value={back} onChange={(e) => setBack(e.target.value)} placeholder="Back" aria-label="Back" autoComplete="off" />
              </div>
            )}
            <div className="cd-add-foot">
              <Pick label="Into" value={groups.includes(into) ? into : into ? NEW : ""} options={into && !groups.includes(into) ? [["", "No group"] as const, ...groups.map((g) => [g, g] as const), [NEW, into] as const] : groupOptions} onChange={async (v) => setInto(v === NEW ? (await named(NEW)) || into : v)} />
              <button type="submit" className="desk-btn desk-main" disabled={busy || !front.trim() || !back.trim()}>
                Add
              </button>
            </div>
          </form>

          {groups.length > 0 && (
            <div className="sp-chips cd-groups" role="group" aria-label="Show">
              <Pill />
              <button type="button" className="sp-chip" aria-pressed={group === null} onClick={() => (setGroup(null), setOpen(-1))}>
                Every card <em>{rows.length}</em>
              </button>
              {groups.map((g) => (
                <button key={g} type="button" className="sp-chip" aria-pressed={group === g} onClick={() => (setGroup(g), setInto(g), setOpen(-1))}>
                  {g} <em>{rows.filter((r) => r[2] === g).length}</em>
                </button>
              ))}
              {loose > 0 && (
                <button type="button" className="sp-chip" aria-pressed={group === ""} onClick={() => (setGroup(""), setInto(""), setOpen(-1))}>
                  No group <em>{loose}</em>
                </button>
              )}
            </div>
          )}
          {/* With one group showing: what can be done to the whole of it. */}
          {group !== null && shown.length > 0 && (
            <div className="cd-whole">
              <span className="mono">All of {group || "these"}</span>
              {group && (
                <button type="button" className="cd-link" disabled={busy} onClick={() => rename(group)}>
                  Rename
                </button>
              )}
              {others.length > 0 && (
                <Pick
                  label="Topic"
                  value=""
                  options={topicOptions}
                  onChange={async (to) => {
                    if (to && (await confirmBox(`Move every card in "${group || "No group"}" to another topic?`, { yes: "Move", danger: false }))) move((r) => (r[2] ?? "") === group, to);
                  }}
                />
              )}
            </div>
          )}
          {rows.length === 0 && <p className="desk-help">No cards in this topic yet.</p>}
          <ul className="cd-list">
            {shown.map(([r, n]) => (
              <li key={`${n}|${r[0]}|${r[1]}`} style={{ ["--n" as string]: Math.min(n, 12) }}>
                <div className="cd-row">
                  <input defaultValue={r[0]} onBlur={(e) => edit(n, 0, e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label="Front" />
                  <input defaultValue={r[1]} onBlur={(e) => edit(n, 1, e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label="Back" />
                  <button type="button" className="cd-more" aria-expanded={open === n} aria-label={`More for ${r[0]}`} onClick={() => setOpen(open === n ? -1 : n)}>
                    {r[2] && group === null ? <em>{r[2]}</em> : null}
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <circle cx="5" cy="12" r="1.8" />
                      <circle cx="12" cy="12" r="1.8" />
                      <circle cx="19" cy="12" r="1.8" />
                    </svg>
                  </button>
                </div>
                <Sheet open={open === n} onClose={() => setOpen(-1)} title={r[0]}>
                  <p className="sheet-sub">{r[1]}</p>
                  <div className="sheet-grid">
                    <label>
                      <span className="mono">Group</span>
                      <Pick label="In" value={r[2] ?? ""} options={groupOptions} onChange={(v) => regroup(n, v)} />
                    </label>
                    {others.length > 0 && (
                      <label>
                        <span className="mono">Another topic</span>
                        <Pick label="To" value="" options={topicOptions} onChange={(to) => to && (setOpen(-1), move((_r, k) => k === n, to))} />
                      </label>
                    )}
                  </div>
                  <div className="sheet-foot">
                    <button type="button" className="sheet-link sheet-bad" disabled={busy} onClick={() => (setOpen(-1), change(rows.filter((_r, k) => k !== n), `“${r[0]}” deleted.`))}>
                      Delete this card
                    </button>
                    <button type="button" className="desk-btn desk-main" onClick={() => setOpen(-1)}>
                      Done
                    </button>
                  </div>
                </Sheet>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function GymScreen() {
  return (
    <>
      <Head trail={[["Admin", "/admin"]]} title="Gym">
        <Go href="/sport/gym" className="desk-btn">
          See the page
        </Go>
      </Head>
      <p className="desk-lede">
        Today's visit, without waiting for Strava. Tap <b>Done</b> on a machine to log it at the weight shown; if it went up, tap <b>+</b> first. When the workout arrives from your watch, it will already show these.
      </p>
      <GymBoard day={today()} />
    </>
  );
}

function MediaScreen() {
  const toast = useContext(Toast);
  const [media, setMedia] = useState<Media[] | null>(null);
  const [busy, setBusy] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(() => api.media().then(setMedia, (err) => toast(err.message, true)), [toast]);
  useEffect(() => void load(), [load]);
  const send = async (files: File[]) => {
    for (const [n, file] of files.entries()) {
      setBusy(`Uploading ${n + 1} of ${files.length}…`);
      try {
        await api.upload(file);
      } catch (err) {
        toast(`${file.name}: ${(err as Error).message}`, true);
      }
    }
    setBusy("");
    load();
  };
  return (
    <>
      <Head trail={[["Admin", "/admin"]]} title="Media library">
        <button type="button" className="desk-btn desk-main" disabled={!!busy} onClick={() => input.current?.click()}>
          {busy || "Upload files"}
        </button>
      </Head>
      <input ref={input} type="file" hidden multiple onChange={(e) => (send([...(e.target.files ?? [])]), (e.target.value = ""))} />
      <p className="desk-lede">Everything you have uploaded: photographs, audio, video, scores and PDFs, up to 200 MB each. You can also upload from inside any form.</p>
      {media && media.length === 0 && <p className="desk-help">Nothing uploaded yet.</p>}
      <ul className="desk-media">
        {media?.map((m) => (
          <li key={m.id} className="glass">
            {m.mime.startsWith("image/") ? <img src={m.url} alt="" loading="lazy" /> : <span className="desk-pick-file">{m.name.split(".").pop()}</span>}
            <strong title={m.name}>{m.name}</strong>
            <span className="desk-count">{size(m.size)}</span>
            <div className="desk-row">
              <button type="button" className="desk-btn" onClick={() => copyText(m.url).then((ok) => toast(ok ? "Address copied." : m.url))}>
                Copy address
              </button>
              <button
                type="button"
                className="desk-btn desk-quiet"
                onClick={async () => {
                  if (!(await confirmBox(`Delete ${m.name}? Anything on the site that uses it will lose it.`))) return;
                  await api.removeMedia(m.id).then(() => toast(`${m.name} deleted.`), (err) => toast(err.message, true));
                  load();
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function SignIn({ onDone, passkeys }: { onDone: () => void; passkeys: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // After the password, when a passkey must follow it.
  const [second, setSecond] = useState(false);
  const finish = async () => {
    // The password (or passkey) was right; make sure the browser kept the sign-in before moving on.
    if (!api.demo && !(await api.session()).signedIn) setError("The sign-in worked, but this browser did not keep the sign-in cookie. If the site is behind a proxy over plain http, set INSECURE_COOKIES=1 in .env and restart; otherwise allow cookies for this address.");
    else onDone();
  };
  const withPasskey = async () => {
    setBusy(true);
    setError("");
    try {
      const options = await api.passkeyChallenge();
      const answer = await startAuthentication({ optionsJSON: options as never });
      await api.passkeySignIn(answer);
      await finish();
    } catch (err) {
      const e = err as Error & { name?: string };
      setError(e.name === "NotAllowedError" ? "The passkey was not used. Try again, or use the password." : e.message);
    }
    setBusy(false);
  };
  return (
    <form
      className="desk-panel desk-signin glass"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const r = await api.signIn(password);
          if (r.needPasskey) {
            setSecond(true);
            setBusy(false);
            return withPasskey();
          }
          await finish();
        } catch (err) {
          setError((err as Error).message);
        }
        setBusy(false);
      }}
    >
      <h1 className="desk-title">Admin</h1>
      {second ? (
        <div className="desk-field" data-wide="true">
          <p className="desk-help">The password is right. Now the passkey: Face ID, Touch ID, a password manager or a security key.</p>
          {error && <p className="desk-error" role="alert">{error}</p>}
          <button type="button" className="desk-btn desk-main" disabled={busy} onClick={withPasskey}>
            {busy ? "Waiting for the passkey…" : "Use the passkey"}
          </button>
        </div>
      ) : (
        <>
          {passkeys && (
            <div className="desk-field" data-wide="true">
              <button type="button" className="desk-btn desk-main" disabled={busy} onClick={withPasskey}>
                {busy ? "Waiting for the passkey…" : "Sign in with a passkey"}
              </button>
              <p className="desk-help">Or with the password:</p>
            </div>
          )}
          <div className="desk-field" data-wide="true">
            <label htmlFor="desk-password">Password</label>
            <input id="desk-password" type="password" autoComplete="current-password" autoFocus={!passkeys} value={password} onChange={(e) => setPassword(e.target.value)} />
            {api.demo && <p className="desk-help">This is the preview: any password works, and nothing you change is kept after you close it.</p>}
            {error && <p className="desk-error" role="alert">{error}</p>}
          </div>
          <button type="submit" className={`desk-btn ${passkeys ? "desk-quiet" : "desk-main"}`} disabled={busy || !password}>
            {busy ? "Checking…" : "Sign in"}
          </button>
        </>
      )}
    </form>
  );
}

// The passkeys that can open the admin area, under Connections.
function PasskeysPanel() {
  const toast = useContext(Toast);
  const [have, setHave] = useState<Passkeys | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.passkeys().then(setHave, (err) => toast(err.message, true));
  }, [toast]);
  const can = typeof window !== "undefined" && "PublicKeyCredential" in window;
  const add = async () => {
    const name = await textBox("A name for this passkey (this MacBook, my iPhone, 1Password…)", "", "Add");
    if (name === null || name === undefined) return;
    setBusy(true);
    try {
      const options = await api.passkeyAddChallenge();
      const answer = await startRegistration({ optionsJSON: options as never });
      setHave(await api.passkeyAdd(answer, name || "Passkey"));
      toast("Passkey added.");
    } catch (err) {
      const e = err as Error & { name?: string };
      toast(e.name === "NotAllowedError" ? "No passkey was made." : e.name === "InvalidStateError" ? "This device already has a passkey for the site." : e.message, true);
    }
    setBusy(false);
  };
  const remove = async (id: string, name: string) => {
    if (!(await confirmBox(`Remove the passkey "${name}"?`, { yes: "Remove" }))) return;
    try {
      setHave(await api.passkeyRemove(id));
      toast("Passkey removed.");
    } catch (err) {
      toast((err as Error).message, true);
    }
  };
  const twoStep = async (on: boolean) => {
    try {
      setHave(await api.passkeyTwoStep(on));
      toast(on ? "The password now needs a passkey after it." : "The password is enough again.");
    } catch (err) {
      toast((err as Error).message, true);
    }
  };
  const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return (
    <section className="desk-panel glass">
      <h2 className="desk-h2">Passkeys</h2>
      <p className="desk-help">
        Sign in with Face ID, Touch ID, a password manager or a security key instead of typing the password. A passkey cannot be phished or guessed. Add one from each device (or from a password manager, which then works everywhere).
      </p>
      {!have ? (
        <p className="desk-help">Loading…</p>
      ) : (
        <>
          {have.passkeys.length > 0 && (
            <ul className="desk-keys">
              {have.passkeys.map((k) => (
                <li key={k.id}>
                  <b>{k.name}</b>
                  <span className="mono">
                    added {when(k.createdAt)}
                    {k.lastUsedAt ? ` · used ${when(k.lastUsedAt)}` : ""}
                  </span>
                  <button type="button" className="desk-btn desk-quiet" onClick={() => remove(k.id, k.name)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="desk-row">
            <button type="button" className="desk-btn desk-main" disabled={busy || !can || api.demo} onClick={add}>
              {busy ? "Waiting…" : "Add a passkey"}
            </button>
            {!can && <span className="desk-help">This browser cannot make passkeys.</span>}
            {api.demo && <span className="desk-help">Passkeys need the real site, not the preview.</span>}
          </div>
          <label className="desk-switch">
            <input type="checkbox" checked={have.twoStep} disabled={!have.passkeys.length} onChange={(e) => twoStep(e.target.checked)} />
            <span>
              Ask for a passkey after the password too
              <small className="desk-help"> — the password alone no longer gets in. Needs a passkey first; lost all of them? Remove the <code>security</code> row from the settings table.</small>
            </span>
          </label>
        </>
      )}
    </section>
  );
}

type Said = { text: string; bad: boolean; n: number; until: number };
let lastSaid: Said | null = null;

// While the admin area is on its way: the shape of a panel, shimmering, rather than a word. After a while, a way out,
// since a page that never arrives is worse than one that says so.
function Waiting() {
  const [long, setLong] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setLong(true), 6000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="desk-skel" role="status" aria-label="Loading">
      <div className="desk-panel glass">
        <span className="desk-skel-line" style={{ width: "34%", height: 28 }} />
        <span className="desk-skel-line" style={{ width: "72%" }} />
        <span className="desk-skel-line" style={{ width: "58%" }} />
        <div className="desk-skel-row">
          <span className="desk-skel-line" style={{ width: 120, height: 40, borderRadius: 999 }} />
          <span className="desk-skel-line" style={{ width: 92, height: 40, borderRadius: 999 }} />
        </div>
      </div>
      {long && (
        <p className="desk-help">
          This is taking a while. <a href="/admin">Load the page again</a>, and if that does not help, clear this site&rsquo;s data in the browser (an old copy of the site can get in the way after an update).
        </p>
      )}
    </div>
  );
}

export function AdminApp() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<{ signedIn: boolean; database: boolean; passwordSet: boolean; passkeys?: boolean; blocked?: boolean } | null>(null);
  // The message is also remembered outside this component: moving from one admin page to another can build the screen afresh, and "Deleted" said just…
  const [toast, setToast] = useState<Said | null>(() => (lastSaid && lastSaid.until > Date.now() ? lastSaid : null));
  const check = useCallback(
    () =>
      api.session().then(
        (now) => {
          setSession(now);
          // The menu and the pencil ask the same question elsewhere: tell them the answer has changed.
          void mutate("/api/admin/session", now, { revalidate: false });
        },
        // A TypeError means the request never reached the site: something in the browser stopped it (an ad
        // blocker, most likely). Any other failure is the site's own, and is shown as such.
        (e: unknown) => setSession({ signedIn: false, database: false, passwordSet: false, blocked: e instanceof TypeError }),
      ),
    [],
  );
  useEffect(() => void check(), [check]);
  const say = useCallback((text: string, bad = false) => {
    lastSaid = { text, bad, n: Date.now(), until: Date.now() + (bad ? 7000 : 3600) };
    setToast(lastSaid);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), Math.max(300, toast.until - Date.now()));
    return () => window.clearTimeout(t);
  }, [toast]);
  const go = useCallback((href: string) => router.push(href), [router]);
  const parts = useMemo(() => pathname.replace(/^\/admin\/?/, "").split("/").filter(Boolean), [pathname]);

  let screen: React.ReactNode;
  if (!session) screen = <Waiting />;
  else if (session.blocked)
    screen = (
      <section className="desk-panel glass">
        <h1 className="desk-title">Something in this browser is in the way</h1>
        <p className="desk-lede">
          The admin area asked the site whether you are signed in, and the request was stopped before it left the browser. That is nearly always an ad blocker or privacy extension. Allow <code>{typeof location === "undefined" ? "this site" : location.host}</code> in it (or turn it off for this site) and <a href="/admin">load the page again</a>.
        </p>
      </section>
    );
  else if (!session.database)
    screen = (
      <section className="desk-panel glass">
        <h1 className="desk-title">No database yet</h1>
        <p className="desk-lede">The site is running without a database, so it is showing its starting content and there is nothing to edit. Run <code>./setup.sh</code> (or <code>docker compose up</code>) to start it with one; the README has the details.</p>
      </section>
    );
  else if (!session.passwordSet)
    screen = (
      <section className="desk-panel glass">
        <h1 className="desk-title">Set a password first</h1>
        <p className="desk-lede">Put <code>ADMIN_PASSWORD</code> (eight characters or more) in the <code>.env</code> file and restart the site.</p>
      </section>
    );
  else if (!session.signedIn) screen = <SignIn onDone={check} passkeys={!!session.passkeys} />;
  else {
    const form = formFor(parts[0] ?? "");
    screen =
      parts.length === 0 ? <Dashboard />
      : parts[0] === "settings" ? <SettingsScreen />
      : parts[0] === "connections" ? <Connections />
      : parts[0] === "cv" ? <CvScreen />
      : parts[0] === "media" ? <MediaScreen />
      : parts[0] === "activities" && parts[1] ? <ActivityEditor key={parts[1]} id={parts[1]} />
      : parts[0] === "activities" ? <ActivitiesScreen />
      : parts[0] === "gym" ? <GymScreen />
      : parts[0] === "score" && parts[1] ? <ScoreScreen key={parts[1]} id={parts[1]} />
      : parts[0] === "find" && parts[1] && parts[2] ? <Find key={parts.join("/")} kinds={parts[1].split(",")} slug={decodeURIComponent(parts[2])} />
      : parts[0] === "cards" ? <CardsScreen key={parts[1] ?? ""} topic={parts[1] ? decodeURIComponent(parts[1]) : ""} />
      : form && parts.length === 1 ? <ListScreen key={form.kind} form={form} />
      : form ? <Editor key={`${form.kind}/${parts[1]}`} form={form} id={parts[1]} />
      : <Head trail={[["Admin", "/admin"]]} title="Not found" />;
  }
  return (
    <Nav.Provider value={go}>
      <Toast.Provider value={say}>
        <AskHost />
        <main className="page desk-page" data-kind="admin">
          <div className="wrap desk-wrap">
            {api.demo && session?.signedIn && <p className="desk-demo">Preview: changes work and show on the site, but are forgotten on reload.</p>}
            {screen}
          </div>
          {/* In <body>, so it sits at the bottom of the window wherever the page has been scrolled to. */}
          {toast &&
            typeof document !== "undefined" &&
            createPortal(
              <p key={toast.n} className="desk-toast" data-bad={toast.bad} role="status" style={{ ["--stay" as string]: `${Math.max(600, toast.until - Date.now())}ms` }}>
                <i aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    {toast.bad ? <path d="M12 7v6.500M12 17.200v.100" /> : <path d="M6.500 12.500l3.800 3.800 7.200-8.300" />}
                  </svg>
                </i>
                <span>{toast.text}</span>
              </p>,
              document.body,
            )}
        </main>
      </Toast.Provider>
    </Nav.Provider>
  );
}
