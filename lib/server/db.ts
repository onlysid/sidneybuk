import "server-only";
import { Pool } from "pg";
import { MIGRATIONS } from "./migrations";

// One pool of connections for the whole server, kept across hot reloads in development.
const holder = globalThis as unknown as { __pool?: Pool; __ready?: Promise<void> };

export const hasDatabase = () => !!process.env.DATABASE_URL;

export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  holder.__pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
  return holder.__pool;
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: unknown[] = []) {
  await ready();
  return (await db().query(text, values)).rows as T[];
}

// Brings the database up to date.
export function ready() {
  holder.__ready ??= (async () => {
    const client = await db().connect();
    try {
      await client.query("select pg_advisory_lock(727001)");
      await client.query("create table if not exists migrations (id text primary key, applied_at timestamptz not null default now())");
      const done = new Set((await client.query("select id from migrations")).rows.map((r) => r.id as string));
      for (const m of MIGRATIONS) {
        if (done.has(m.id)) continue;
        await client.query("begin");
        try {
          await client.query(m.sql);
          await client.query("insert into migrations (id) values ($1)", [m.id]);
          await client.query("commit");
          console.log(`[db] applied ${m.id}`);
        } catch (err) {
          await client.query("rollback");
          throw err;
        }
      }
    } finally {
      await client.query("select pg_advisory_unlock(727001)").catch(() => {});
      client.release();
    }
  })().catch((err) => {
    holder.__ready = undefined; // try again on the next request rather than staying broken
    throw err;
  });
  return holder.__ready;
}
