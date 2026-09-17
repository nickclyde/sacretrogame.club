import { neon } from "@neondatabase/serverless";
import { nameKey, type Ballot, type BallotInput } from "./ballot";

type Row = {
  name: string;
  slot_ranking: string[];
  week_ranking: string[];
  library_ranking: string[];
  drive_minutes: Ballot["driveMinutes"];
  updated_at: string | Date;
};

const url = process.env.DATABASE_URL;
const sql = url ? neon(url) : null;

// Without DATABASE_URL (local dev before the database exists) ballots live in memory.
const g = globalThis as { __devBallots?: Map<string, Ballot> };
function devStore() {
  if (process.env.NODE_ENV === "production") throw new Error("DATABASE_URL is not set");
  return (g.__devBallots ??= new Map());
}

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
  if (!sql) return [...devStore().values()];
  const rows = (await sql`select * from ballots order by created_at`) as Row[];
  return rows.map(fromRow);
}

export async function getBallotByName(name: string): Promise<Ballot | null> {
  const key = nameKey(name);
  if (!sql) return devStore().get(key) ?? null;
  const rows = (await sql`select * from ballots where name_key = ${key}`) as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function upsertBallot(b: BallotInput): Promise<void> {
  const key = nameKey(b.name);
  if (!sql) {
    devStore().set(key, { ...b, updatedAt: new Date().toISOString() });
    return;
  }
  await sql`
    insert into ballots (name, name_key, slot_ranking, week_ranking, library_ranking, drive_minutes)
    values (${b.name}, ${key}, ${JSON.stringify(b.slots)}, ${JSON.stringify(b.weeks)},
            ${JSON.stringify(b.libraries)}, ${b.driveMinutes ? JSON.stringify(b.driveMinutes) : null})
    on conflict (name_key) do update set
      name = excluded.name,
      slot_ranking = excluded.slot_ranking,
      week_ranking = excluded.week_ranking,
      library_ranking = excluded.library_ranking,
      drive_minutes = excluded.drive_minutes,
      updated_at = now()`;
}
