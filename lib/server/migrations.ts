// The database's structure, as a list of steps.
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "001_init",
    sql: `
      create extension if not exists pgcrypto;

      -- Every piece of content: a blog post, a book, a place, a piece of music…
      -- "kind" says which; "data" holds the whole thing in the same shape the site uses (see lib/*.ts).
      create table entries (
        id uuid primary key default gen_random_uuid(),
        kind text not null,
        slug text not null,
        title text not null default '',
        data jsonb not null default '{}',
        published boolean not null default true,
        position integer not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (kind, slug)
      );
      create index entries_kind on entries (kind, position);

      -- Site settings, and API keys for other services. Secret values are stored encrypted.
      create table settings (
        key text primary key,
        value jsonb,
        secret boolean not null default false,
        updated_at timestamptz not null default now()
      );

      -- Files uploaded in the admin area. The files themselves live on disk in UPLOAD_DIR.
      create table media (
        id uuid primary key default gen_random_uuid(),
        path text not null unique,
        name text not null,
        mime text not null,
        size integer not null,
        created_at timestamptz not null default now()
      );
    `,
  },
  {
    id: "002_sport",
    sql: `
      -- Activities brought in from Strava. The columns are what lists and totals need; "summary" and "detail"
      -- keep everything Strava sent, so new things can be shown later without importing again.
      create table activities (
        id bigint primary key,
        sport text not null,
        name text not null default '',
        start_utc timestamptz not null,
        start_local text not null,
        distance real not null default 0,
        moving integer not null default 0,
        elapsed integer not null default 0,
        climb real not null default 0,
        hr real,
        max_hr real,
        kudos integer not null default 0,
        polyline text,
        summary jsonb not null default '{}',
        detail jsonb,
        hidden boolean not null default false,
        updated_at timestamptz not null default now()
      );
      create index activities_start on activities (start_utc desc);

      -- Numbers from my phone's health app: one value per measure per day.
      create table health (
        metric text not null,
        day date not null,
        value real not null,
        primary key (metric, day)
      );
    `,
  },
  {
    id: "003_runlog",
    sql: `
      -- What I add to an activity myself: the kind of run, how it felt, a note. Kept apart from what Strava
      -- sends, so a sync never overwrites it. Activities made by hand (the old spreadsheet, or a run typed in)
      -- have negative ids, which Strava never uses.
      alter table activities add column log jsonb not null default '{}';
    `,
  },
  {
    id: "004_passkeys",
    sql: `
      -- Passkeys for signing in to the admin area (WebAuthn). One row per device or password manager.
      create table if not exists passkeys (
        id text primary key,                 -- the credential id, base64url
        public_key text not null,            -- COSE public key, base64url
        counter bigint not null default 0,
        transports jsonb not null default '[]',
        name text not null default '',
        created_at timestamptz not null default now(),
        last_used_at timestamptz
      );
    `,
  },
];
