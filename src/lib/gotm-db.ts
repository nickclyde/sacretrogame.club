import { NOMINATIONS_PER_PERSON } from "@/data/gotm";
import { sql } from "./db";
import { gotmCycle, type Cycle, type Nomination } from "./gotm";

const toDate = (v: unknown) => (v ? new Date(v as string) : null);

/** The current cycle, with any open or close times an admin set. */
export async function currentCycle(now = new Date()): Promise<Cycle> {
  const base = gotmCycle(now);
  const [row] = await sql<{ vote_opens_at: unknown; vote_closes_at: unknown }>`
    select vote_opens_at, vote_closes_at from gotm_cycles where key = ${base.key}`;
  return row ? gotmCycle(now, { voteOpensAt: toDate(row.vote_opens_at), voteClosesAt: toDate(row.vote_closes_at) }) : base;
}

export async function setVoteTimes(key: string, times: { opensAt?: Date | null; closesAt?: Date | null }) {
  const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
  await sql`insert into gotm_cycles (key) values (${key}) on conflict do nothing`;
  if (times.opensAt !== undefined) await sql`update gotm_cycles set vote_opens_at = ${iso(times.opensAt)} where key = ${key}`;
  if (times.closesAt !== undefined) await sql`update gotm_cycles set vote_closes_at = ${iso(times.closesAt)} where key = ${key}`;
}

/** Back to the regular schedule. Also forgets a recorded winner so a reopened vote is counted again. */
export async function resetVoteTimes(key: string) {
  await sql`
    update gotm_cycles set vote_opens_at = null, vote_closes_at = null, winner_announced_at = null, winner_nomination_id = null
    where key = ${key}`;
}

type NominationRow = {
  id: string;
  user_id: string;
  display_name: string;
  igdb_id: number | null;
  title: string;
  platform: string;
  year: number | null;
  cover_url: string | null;
  cover_width: number | null;
  cover_height: number | null;
  info_url: string | null;
  pitch: string | null;
};

function fromRow(r: NominationRow): Nomination {
  return {
    id: r.id,
    userId: r.user_id,
    nominator: r.display_name,
    igdbId: r.igdb_id,
    title: r.title,
    platform: r.platform,
    year: r.year,
    cover: r.cover_url ? { src: r.cover_url, width: r.cover_width!, height: r.cover_height! } : null,
    infoUrl: r.info_url,
    pitch: r.pitch,
  };
}

/** Standing nominations in the order they were made. */
export async function listNominations(cycle: string): Promise<Nomination[]> {
  const rows = await sql<NominationRow>`
    select n.*, u.display_name from nominations n join users u on u.id = n.user_id
    where n.cycle = ${cycle} and n.removed_at is null
    order by n.created_at, n.id`;
  return rows.map(fromRow);
}

export type NewNomination = Omit<Nomination, "id" | "userId" | "nominator">;

export type AddResult = { nomination: Nomination } | { error: "limit" } | { error: "duplicate"; by: string };

export async function addNomination(cycle: string, userId: string, n: NewNomination): Promise<AddResult> {
  const duplicate = async (): Promise<AddResult | null> => {
    const [dup] = await sql<{ display_name: string }>`
      select u.display_name from nominations n join users u on u.id = n.user_id
      where n.cycle = ${cycle} and n.removed_at is null
        and (n.igdb_id = ${n.igdbId} or (lower(n.title) = lower(${n.title}) and n.platform = ${n.platform}))`;
    return dup ? { error: "duplicate", by: dup.display_name } : null;
  };
  const dup = await duplicate();
  if (dup) return dup;

  let rows: { id: string }[];
  try {
    rows = await sql<{ id: string }>`
      insert into nominations (cycle, user_id, igdb_id, title, platform, year, cover_url, cover_width, cover_height, info_url, pitch)
      select ${cycle}, ${userId}, ${n.igdbId}, ${n.title}, ${n.platform}, ${n.year}, ${n.cover?.src ?? null}, ${n.cover?.width ?? null}, ${n.cover?.height ?? null}, ${n.infoUrl}, ${n.pitch}
      where (select count(*) from nominations
             where cycle = ${cycle} and user_id = ${userId} and removed_at is null) < ${NOMINATIONS_PER_PERSON}
      returning id`;
  } catch (e) {
    // Someone else nominated the same game a moment earlier.
    if ((e as { code?: string }).code === "23505") return (await duplicate()) ?? { error: "duplicate", by: "someone" };
    throw e;
  }
  if (!rows[0]) return { error: "limit" };
  const nomination = (await listNominations(cycle)).find((x) => x.id === rows[0].id)!;
  return { nomination };
}

/**
 * Takes a nomination off the ballot. People can withdraw their own until voting opens;
 * admins can remove any nomination at any time.
 */
export async function removeNomination(id: string, by: { id: string; isAdmin: boolean }, cycle: Cycle) {
  const rows = by.isAdmin
    ? await sql`update nominations set removed_at = now() where id = ${id} and removed_at is null returning id`
    : cycle.phase === "nominating"
      ? await sql`
          update nominations set removed_at = now()
          where id = ${id} and user_id = ${by.id} and cycle = ${cycle.key} and removed_at is null
          returning id`
      : [];
  return rows.length > 0;
}

export async function getGameBallot(cycle: string, userId: string): Promise<string[] | null> {
  const [row] = await sql<{ ranking: string[] }>`
    select ranking from game_ballots where cycle = ${cycle} and user_id = ${userId}`;
  return row?.ranking ?? null;
}

export async function saveGameBallot(cycle: string, userId: string, ranking: string[]) {
  await sql`
    insert into game_ballots (cycle, user_id, ranking) values (${cycle}, ${userId}, ${JSON.stringify(ranking)})
    on conflict (cycle, user_id) do update set ranking = excluded.ranking, updated_at = now()`;
}

/** Every ballot for a cycle with the voter's name, oldest first. Rankings are never shown. */
export async function listGameBallots(cycle: string): Promise<{ name: string; ranking: string[] }[]> {
  return sql<{ name: string; ranking: string[] }>`
    select u.display_name as name, b.ranking from game_ballots b join users u on u.id = b.user_id
    where b.cycle = ${cycle} order by b.created_at`;
}

/**
 * Marks a cycle's "voting is open" or "we have a winner" moment as announced. Only the first
 * caller gets true, so each Discord post goes out once however many requests notice the moment.
 */
export async function claimAnnouncement(key: string, kind: "opened" | "winner", winnerId: string | null = null) {
  const rows =
    kind === "opened"
      ? await sql`
          insert into gotm_cycles (key, opened_announced_at) values (${key}, now())
          on conflict (key) do update set opened_announced_at = now() where gotm_cycles.opened_announced_at is null
          returning key`
      : await sql`
          insert into gotm_cycles (key, winner_announced_at, winner_nomination_id) values (${key}, now(), ${winnerId})
          on conflict (key) do update set winner_announced_at = now(), winner_nomination_id = ${winnerId}
          where gotm_cycles.winner_announced_at is null
          returning key`;
  return rows.length > 0;
}

/** The winner recorded when a cycle's vote was settled, if it has been. */
export async function storedWinner(key: string): Promise<{ settled: boolean; winner: Nomination | null }> {
  const [row] = await sql<{ winner_announced_at: unknown; winner_nomination_id: string | null }>`
    select winner_announced_at, winner_nomination_id from gotm_cycles where key = ${key}`;
  if (!row?.winner_announced_at) return { settled: false, winner: null };
  if (!row.winner_nomination_id) return { settled: true, winner: null };
  const [n] = await sql<NominationRow>`
    select n.*, u.display_name from nominations n join users u on u.id = n.user_id
    where n.id = ${row.winner_nomination_id}`;
  return { settled: true, winner: n ? fromRow(n) : null };
}
