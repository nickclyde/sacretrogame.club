import { readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import type { PGlite } from "@electric-sql/pglite";
import { nameKey, type Ballot, type BallotInput } from "./ballot";

type Query = (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

const url = process.env.DATABASE_URL;
const neonSql = url ? neon(url) : null;

// Without DATABASE_URL (local dev and tests) queries run against an in-memory Postgres
// with db/schema.sql applied, so every query behaves the same as it does on Neon.
const g = globalThis as { __devDb?: Promise<PGlite> };
function devDb() {
  if (process.env.NODE_ENV === "production") throw new Error("DATABASE_URL is not set");
  return (g.__devDb ??= (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = await PGlite.create();
    await db.exec(await readFile(path.join(process.cwd(), "db/schema.sql"), "utf8"));
    return db;
  })());
}

/** Starts the dev database over from an empty schema. For tests. */
export function resetDevDb() {
  g.__devDb = undefined;
}

const run: Query = neonSql
  ? (text, params) => neonSql.query(text, params) as Promise<Record<string, unknown>[]>
  : async (text, params) => (await (await devDb()).query<Record<string, unknown>>(text, params)).rows;

/** Tagged template query. Interpolated values are always sent as parameters. */
export async function sql<T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  const text = strings.reduce((acc, s, i) => acc + `$${i}` + s);
  return (await run(text, values)) as T[];
}

type Row = {
  name: string;
  slot_ranking: string[];
  week_ranking: string[];
  library_ranking: string[];
  drive_minutes: Ballot["driveMinutes"];
  updated_at: string | Date;
};

function fromRow(r: Row): Ballot {
  return {
    name: r.name,
    slots: r.slot_ranking,
    weeks: r.week_ranking,
    libraries: r.library_ranking,
    driveMinutes: r.drive_minutes,
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function getBallots(): Promise<Ballot[]> {
  const rows = await sql<Row>`select * from ballots order by created_at`;
  return rows.map(fromRow);
}

export async function getBallotByName(name: string): Promise<Ballot | null> {
  const rows = await sql<Row>`select * from ballots where name_key = ${nameKey(name)}`;
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function upsertBallot(b: BallotInput): Promise<void> {
  await sql`
    insert into ballots (name, name_key, slot_ranking, week_ranking, library_ranking, drive_minutes)
    values (${b.name}, ${nameKey(b.name)}, ${JSON.stringify(b.slots)}, ${JSON.stringify(b.weeks)},
            ${JSON.stringify(b.libraries)}, ${b.driveMinutes ? JSON.stringify(b.driveMinutes) : null})
    on conflict (name_key) do update set
      name = excluded.name,
      slot_ranking = excluded.slot_ranking,
      week_ranking = excluded.week_ranking,
      library_ranking = excluded.library_ranking,
      drive_minutes = excluded.drive_minutes,
      updated_at = now()`;
}
