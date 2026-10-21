import { after } from "next/server";
import { GAME_PICKS, type GamePick } from "@/data/games";
import { MEETINGS } from "@/data/meeting";
import { sql } from "./db";
import { announceGotm, finishedMessage } from "./discord";
import { pickForMonth } from "./game-picks";
import { monthKey, previousKey } from "./gotm";
import { nextMeeting } from "./meeting";
import { gameProgress, raConfigured, raGameIdFromUrl, userAwards, type RaAward, type RaProgress, type RaUser } from "./retroachievements";

// Who finished each month's game of the month. Members tick a box on the honor system, or link
// a RetroAchievements account and the site picks up their "Game Beaten" awards. There is no
// scheduler: page loads check a few linked accounts at a time in the background.

/** A month whose game can be finished, with the RetroAchievements sets that count for it. */
export type FinishMonth = {
  key: string;
  pick: GamePick;
  raGameIds: number[];
  /** RA awards count from the meetup where the game was picked, so older playthroughs don't. */
  since: Date;
};

export type Finish = { finishedAt: Date; masteredAt: Date | null; hardcore: boolean };

export type Finisher = Finish & { month: string; userId: string; name: string; via: "honor" | "ra"; raUsername: string | null };

/** Linked accounts are checked again after this long. */
const RECHECK_MIN = 30;
/** How many accounts one page load checks, so a load never fans out into many RA calls. */
const CHECKS_PER_SYNC = 10;
/** Finishes found later than this after the fact, like old awards found on linking, get no Discord post. */
const SHOUT_OUT_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** The meetup held in a month, given as YYYY-MM. */
function meetupIn(key: string) {
  const [y, m] = key.split("-").map(Number);
  return nextMeeting(MEETINGS, new Date(Date.UTC(y, m - 1, 1, 12)));
}

/** The month whose game is being played now: the one discussed at the next meetup. */
export function playingMonth(now = new Date()) {
  return monthKey(nextMeeting(MEETINGS, now).start);
}

/** Every month with a game, newest first, up to the one being played now. */
export async function finishMonths(now = new Date()): Promise<FinishMonth[]> {
  const current = playingMonth(now);
  const cycles = await sql<{ key: string; ra_game_ids: number[] | null; winner_nomination_id: string | null }>`
    select key, ra_game_ids, winner_nomination_id from gotm_cycles`;
  const stored = new Map(cycles.map((c) => [c.key, c.ra_game_ids ?? []]));
  const keys = new Set([...Object.keys(GAME_PICKS), ...cycles.filter((c) => c.winner_nomination_id).map((c) => c.key), current]);
  const months = await Promise.all(
    [...keys]
      .filter((key) => key <= current)
      .sort()
      .reverse()
      .map(async (key): Promise<FinishMonth | null> => {
        const pick = await pickForMonth(key);
        if (!pick) return null;
        const fromPick = pick.achievementsUrl ? raGameIdFromUrl(pick.achievementsUrl) : null;
        const raGameIds = [...new Set([...(fromPick ? [fromPick] : []), ...(stored.get(key) ?? [])])];
        return { key, pick, raGameIds, since: meetupIn(previousKey(key)).start };
      }),
  );
  return months.filter((m): m is FinishMonth => m !== null);
}

/** Which months a member's RA awards finish. Mastering a set that has no "beaten" award also counts. */
export function matchAwards(awards: RaAward[], months: Pick<FinishMonth, "key" | "raGameIds" | "since">[]): Map<string, Finish> {
  const found = new Map<string, Finish>();
  for (const m of months) {
    const mine = awards.filter((a) => m.raGameIds.includes(a.gameId) && a.at >= m.since);
    if (mine.length === 0) continue;
    const earliest = (kind: RaAward["kind"]) => Math.min(...mine.filter((a) => a.kind === kind).map((a) => a.at.getTime()));
    const beaten = earliest("beaten");
    const mastered = earliest("mastered");
    found.set(m.key, {
      finishedAt: new Date(Math.min(beaten, mastered)),
      masteredAt: Number.isFinite(mastered) ? new Date(mastered) : null,
      hardcore: mine.some((a) => a.hardcore),
    });
  }
  return found;
}

type FinisherRow = {
  month: string;
  user_id: string;
  via: "honor" | "ra";
  finished_at: string | Date;
  mastered_at: string | Date | null;
  hardcore: boolean;
  display_name: string;
  ra_username: string | null;
};

/** Everyone who finished anything, in the order they finished. */
export async function listFinishers(): Promise<Finisher[]> {
  const rows = await sql<FinisherRow>`
    select c.month, c.user_id, c.via, c.finished_at, c.mastered_at, c.hardcore, u.display_name, u.ra_username
    from completions c join users u on u.id = c.user_id
    where c.removed_at is null
    order by c.finished_at, c.created_at`;
  return rows.map((r) => ({
    month: r.month,
    userId: r.user_id,
    name: r.display_name,
    via: r.via,
    finishedAt: new Date(r.finished_at),
    masteredAt: r.mastered_at ? new Date(r.mastered_at) : null,
    hardcore: r.hardcore,
    raUsername: r.ra_username,
  }));
}

export async function countFinishers(month: string): Promise<number> {
  const [row] = await sql<{ n: number }>`select count(*)::int as n from completions where month = ${month} and removed_at is null`;
  return row.n;
}

export type AllTimeRow = { userId: string; name: string; raUsername: string | null; finished: number; mastered: number; first: Date };

/** Members by games finished, then games mastered, then who got going first. */
export function allTime(finishers: Finisher[]): AllTimeRow[] {
  const byUser = new Map<string, AllTimeRow>();
  for (const f of finishers) {
    const row = byUser.get(f.userId) ?? { userId: f.userId, name: f.name, raUsername: f.raUsername, finished: 0, mastered: 0, first: f.finishedAt };
    row.finished++;
    if (f.masteredAt) row.mastered++;
    if (f.finishedAt < row.first) row.first = f.finishedAt;
    byUser.set(f.userId, row);
  }
  return [...byUser.values()].sort((a, b) => b.finished - a.finished || b.mastered - a.mastered || a.first.getTime() - b.first.getTime());
}

/** Ticks or unticks the honor system box. RA finishes can't be unticked, so that returns "ra". */
export async function setHonorFinish(month: string, userId: string, done: boolean): Promise<"ok" | "ra"> {
  if (done) {
    await sql`
      insert into completions (month, user_id, via, finished_at) values (${month}, ${userId}, 'honor', now())
      on conflict (month, user_id) do update set removed_at = null, finished_at = now()
      where completions.removed_at is not null`;
    return "ok";
  }
  const [row] = await sql<{ via: string }>`
    update completions set removed_at = case when via = 'honor' then now() else removed_at end
    where month = ${month} and user_id = ${userId} and removed_at is null
    returning via`;
  return row?.via === "ra" ? "ra" : "ok";
}

/** Records a finish found on RetroAchievements. It takes over from a ticked box, and never goes away on its own. */
export async function recordRaFinish(month: string, userId: string, f: Finish) {
  await sql`
    insert into completions (month, user_id, via, finished_at, mastered_at, hardcore)
    values (${month}, ${userId}, 'ra', ${iso(f.finishedAt)}, ${iso(f.masteredAt)}, ${f.hardcore})
    on conflict (month, user_id) do update set
      finished_at = case when completions.via = 'ra' then least(completions.finished_at, excluded.finished_at) else excluded.finished_at end,
      via = 'ra',
      mastered_at = least(completions.mastered_at, excluded.mastered_at),
      hardcore = completions.hardcore or excluded.hardcore,
      removed_at = null`;
}

/**
 * Claims the Discord post for someone's finish. Only the first caller gets the message, and
 * unticking keeps the claim, so ticking again doesn't post twice.
 */
export async function claimShoutOut(month: FinishMonth, userId: string, now = new Date()): Promise<string | null> {
  const [row] = await sql<{ display_name: string; via: "honor" | "ra"; finished_at: string | Date; mastered_at: unknown; hardcore: boolean }>`
    update completions c set announced_at = now()
    from users u
    where u.id = c.user_id and c.month = ${month.key} and c.user_id = ${userId}
      and c.announced_at is null and c.removed_at is null
    returning u.display_name, c.via, c.finished_at, c.mastered_at, c.hardcore`;
  if (!row || now.getTime() - new Date(row.finished_at).getTime() > SHOUT_OUT_WITHIN_MS) return null;
  const note = { via: row.via, mastered: Boolean(row.mastered_at), hardcore: row.hardcore };
  return finishedMessage(month.key, row.display_name, month.pick.title, note, await countFinishers(month.key));
}

/**
 * Checks linked RetroAchievements accounts for new finishes: the given member's right away, or
 * otherwise a few that haven't been checked lately. Returns the Discord posts to send.
 * A failed lookup for one member only throws when that member asked for it.
 */
export async function syncRa(onlyUserId?: string): Promise<string[]> {
  if (!raConfigured()) return [];
  const months = (await finishMonths()).filter((m) => m.raGameIds.length > 0);
  if (months.length === 0) return [];
  // Stamping first claims these accounts, so overlapping page loads don't check them twice.
  const users = onlyUserId
    ? await sql<{ id: string; ra_ulid: string }>`
        update users set ra_synced_at = now() where id = ${onlyUserId} and ra_ulid is not null
        returning id, ra_ulid`
    : await sql<{ id: string; ra_ulid: string }>`
        update users set ra_synced_at = now()
        where id in (
          select id from users
          where ra_ulid is not null and (ra_synced_at is null or ra_synced_at < now() - make_interval(mins => ${RECHECK_MIN}))
          order by ra_synced_at nulls first limit ${CHECKS_PER_SYNC})
        and (ra_synced_at is null or ra_synced_at < now() - make_interval(mins => ${RECHECK_MIN}))
        returning id, ra_ulid`;

  // Progress only matters for the game being played, and only until someone finishes it.
  const playing = months.find((m) => m.key === playingMonth());
  const finished = playing
    ? new Set(
        (await sql<{ user_id: string }>`select user_id from completions where month = ${playing.key} and removed_at is null`).map(
          (r) => r.user_id,
        ),
      )
    : new Set<string>();

  const messages: string[] = [];
  for (const user of users) {
    let awards: RaAward[];
    let progress: { gameId: number; progress: RaProgress } | null;
    try {
      [awards, progress] = await Promise.all([
        userAwards(user.ra_ulid),
        playing && !finished.has(user.id) ? bestProgress(user.ra_ulid, playing) : null,
      ]);
    } catch (e) {
      if (onlyUserId) throw e;
      console.error("RetroAchievements check failed", e);
      continue;
    }
    if (playing && progress) await recordProgress(playing.key, user.id, progress.gameId, progress.progress);
    for (const [key, finish] of matchAwards(awards, months)) {
      await recordRaFinish(key, user.id, finish);
      const message = await claimShoutOut(months.find((m) => m.key === key)!, user.id);
      if (message) messages.push(message);
    }
  }
  return messages;
}

const stepRatio = (p: RaProgress) => (p.stepsTotal ? p.stepsDone / p.stepsTotal : 0);
const ahead = (a: RaProgress, b: RaProgress) => stepRatio(a) - stepRatio(b) || a.earned - b.earned;

/** A member's progress on whichever of the month's RA sets they're furthest along in. */
async function bestProgress(ulid: string, month: FinishMonth) {
  const all = await Promise.all(
    month.raGameIds.map(async (gameId) => ({ gameId, progress: await gameProgress(ulid, gameId, month.since) })),
  );
  let best: { gameId: number; progress: RaProgress } | null = null;
  for (const { gameId, progress } of all) {
    if (progress && (!best || ahead(progress, best.progress) > 0)) best = { gameId, progress };
  }
  return best;
}

export async function recordProgress(month: string, userId: string, gameId: number, p: RaProgress) {
  await sql`
    insert into ra_progress (month, user_id, ra_game_id, steps_done, steps_total, beatable, earned, total, last_title, last_badge, last_at)
    values (${month}, ${userId}, ${gameId}, ${p.stepsDone}, ${p.stepsTotal}, ${p.beatable}, ${p.earned}, ${p.total},
      ${p.last?.title ?? null}, ${p.last?.badge ?? null}, ${iso(p.last?.at ?? null)})
    on conflict (month, user_id) do update set
      ra_game_id = excluded.ra_game_id, steps_done = excluded.steps_done, steps_total = excluded.steps_total,
      beatable = excluded.beatable, earned = excluded.earned, total = excluded.total,
      last_title = excluded.last_title, last_badge = excluded.last_badge, last_at = excluded.last_at,
      updated_at = now()`;
}

export type Progress = Omit<RaProgress, "last"> & {
  userId: string;
  name: string;
  raUsername: string | null;
  last: { title: string; badge: string; at: Date } | null;
};

type ProgressRow = {
  user_id: string;
  display_name: string;
  ra_username: string | null;
  steps_done: number;
  steps_total: number;
  beatable: boolean;
  earned: number;
  total: number;
  last_title: string | null;
  last_badge: string | null;
  last_at: string | Date | null;
};

/** Linked members partway through a month's game, furthest along first. Finishers are on the board instead. */
export async function listProgress(month: string): Promise<Progress[]> {
  const rows = await sql<ProgressRow>`
    select p.user_id, u.display_name, u.ra_username, p.steps_done, p.steps_total, p.beatable, p.earned, p.total,
      p.last_title, p.last_badge, p.last_at
    from ra_progress p join users u on u.id = p.user_id
    where p.month = ${month} and p.earned > 0 and u.ra_ulid is not null
      and not exists (select 1 from completions c where c.month = p.month and c.user_id = p.user_id and c.removed_at is null)
    order by p.steps_done::float / greatest(p.steps_total, 1) desc, p.earned desc, p.last_at`;
  return rows.map((r) => ({
    userId: r.user_id,
    name: r.display_name,
    raUsername: r.ra_username,
    stepsDone: r.steps_done,
    stepsTotal: r.steps_total,
    beatable: r.beatable,
    earned: r.earned,
    total: r.total,
    last: r.last_title && r.last_badge && r.last_at ? { title: r.last_title, badge: r.last_badge, at: new Date(r.last_at) } : null,
  }));
}

/** Checks a few linked accounts after the response is sent, so pages never wait on RetroAchievements. */
export function syncRaLater() {
  if (!raConfigured()) return;
  after(async () => {
    try {
      for (const message of await syncRa()) await announceGotm(message);
    } catch (e) {
      console.error("RetroAchievements sync failed", e);
    }
  });
}

/** The RetroAchievements account a member linked, if any. */
export async function getRaAccount(userId: string): Promise<{ username: string } | null> {
  const [row] = await sql<{ ra_username: string | null }>`select ra_username from users where id = ${userId}`;
  return row?.ra_username ? { username: row.ra_username } : null;
}

/** Links an RA account. Returns false if another member already linked it. */
export async function linkRa(userId: string, ra: RaUser): Promise<boolean> {
  try {
    await sql`update users set ra_ulid = ${ra.ulid}, ra_username = ${ra.username}, ra_synced_at = null where id = ${userId}`;
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return false;
    throw e;
  }
}

/** Forgets the RA account. Finishes it already found stay on the board, but progress goes. */
export async function unlinkRa(userId: string) {
  await sql`update users set ra_ulid = null, ra_username = null, ra_synced_at = null where id = ${userId}`;
  await sql`delete from ra_progress where user_id = ${userId}`;
}
