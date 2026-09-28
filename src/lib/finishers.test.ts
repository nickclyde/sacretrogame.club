import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signInWith } from "./auth/users";
import { resetDevDb, sql } from "./db";
import {
  allTime,
  claimShoutOut,
  finishMonths,
  listFinishers,
  matchAwards,
  recordRaFinish,
  setHonorFinish,
  syncRa,
  type Finisher,
} from "./finishers";
import { setRaGameIds } from "./gotm-db";
import type { RaAward } from "./retroachievements";

// October 2026's game is A Link to the Past (RA set 355), picked at the September 9 meetup.
const OCT = "2026-10";
const PICKED = new Date("2026-09-10T01:00:00Z"); // 6 PM Pacific on September 9.

async function user(name: string) {
  const r = await signInWith({ provider: "discord", subject: name, email: null, displayName: name }, null);
  if (!("userId" in r)) throw new Error("sign-in failed");
  return r.userId;
}

const award = (gameId: number, kind: RaAward["kind"], at: string, hardcore = false): RaAward => ({ gameId, kind, hardcore, at: new Date(at) });

beforeEach(() => {
  resetDevDb();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("finishMonths", () => {
  it("lists months with a game up to the one being played, with the RA sets that count", async () => {
    const [oct] = await finishMonths();
    expect(oct).toMatchObject({ key: OCT, raGameIds: [355], since: PICKED });
    expect(oct.pick.title).toBe("The Legend of Zelda: A Link to the Past");
    await setRaGameIds(OCT, [355, 7000]);
    expect((await finishMonths())[0].raGameIds).toEqual([355, 7000]);
  });
});

describe("matchAwards", () => {
  const months = [{ key: OCT, raGameIds: [355], since: PICKED }];

  it("counts the earliest beaten award after the pick, and mastery as a bonus", () => {
    const found = matchAwards(
      [award(355, "beaten", "2026-09-20T00:00:00Z"), award(355, "mastered", "2026-09-25T00:00:00Z", true), award(319, "beaten", "2026-09-21T00:00:00Z")],
      months,
    );
    expect(found.get(OCT)).toEqual({ finishedAt: new Date("2026-09-20T00:00:00Z"), masteredAt: new Date("2026-09-25T00:00:00Z"), hardcore: true });
  });

  it("ignores awards from before the game was picked", () => {
    expect(matchAwards([award(355, "beaten", "2016-12-30T00:00:00Z")], months).size).toBe(0);
  });

  it("counts mastering a set that has no beaten award", () => {
    const found = matchAwards([award(355, "mastered", "2026-09-25T00:00:00Z")], months);
    expect(found.get(OCT)?.finishedAt).toEqual(new Date("2026-09-25T00:00:00Z"));
  });
});

describe("completions", () => {
  it("tick and untick on the honor system, posting to Discord only once", async () => {
    const ana = await user("Ana");
    const [oct] = await finishMonths();
    await setHonorFinish(OCT, ana, true);
    expect(await claimShoutOut(oct, ana)).toContain("**Ana** finished **The Legend of Zelda: A Link to the Past**, October's game");
    await setHonorFinish(OCT, ana, false);
    expect(await listFinishers()).toEqual([]);
    await setHonorFinish(OCT, ana, true);
    expect(await claimShoutOut(oct, ana)).toBeNull();
    expect(await listFinishers()).toHaveLength(1);
  });

  it("take over a ticked box with the RA award, which can't be unticked", async () => {
    const ana = await user("Ana");
    await setHonorFinish(OCT, ana, true);
    await recordRaFinish(OCT, ana, { finishedAt: new Date("2026-09-20T00:00:00Z"), masteredAt: null, hardcore: false });
    await recordRaFinish(OCT, ana, { finishedAt: new Date("2026-09-22T00:00:00Z"), masteredAt: new Date("2026-09-25T00:00:00Z"), hardcore: true });
    expect(await setHonorFinish(OCT, ana, false)).toBe("ra");
    expect(await listFinishers()).toMatchObject([
      { name: "Ana", via: "ra", finishedAt: new Date("2026-09-20T00:00:00Z"), masteredAt: new Date("2026-09-25T00:00:00Z"), hardcore: true },
    ]);
  });
});

describe("syncRa", () => {
  it("records new finishes from linked accounts, then waits before checking again", async () => {
    vi.stubEnv("RA_API_KEY", "test-key");
    const ana = await user("Ana");
    await user("Bo");
    await sql`update users set ra_ulid = 'ULID-ANA', ra_username = 'ana_ra' where id = ${ana}`;
    const fetch = vi.fn<(url: string) => Promise<Response>>(async () =>
      Response.json({ VisibleUserAwards: [{ AwardedAt: "2026-09-28T00:00:00+00:00", AwardType: "Game Beaten", AwardData: 355, AwardDataExtra: 1 }] }),
    );
    vi.stubGlobal("fetch", fetch);

    const messages = await syncRa();
    expect(messages).toEqual([expect.stringContaining("(beaten on RetroAchievements in hardcore)")]);
    expect(String(fetch.mock.calls[0][0])).toContain("API_GetUserAwards.php?u=ULID-ANA&y=test-key");
    expect(await listFinishers()).toMatchObject([{ name: "Ana", via: "ra", raUsername: "ana_ra" }]);

    expect(await syncRa()).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
    // Asking for one member skips the wait, and a finish that's already recorded isn't posted again.
    expect(await syncRa(ana)).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("allTime", () => {
  it("ranks by games finished, then mastered, then who finished first", () => {
    const f = (userId: string, month: string, at: string, mastered = false): Finisher => ({
      month, userId, name: userId, via: "honor", raUsername: null, finishedAt: new Date(at), masteredAt: mastered ? new Date(at) : null, hardcore: false,
    });
    const rows = allTime([
      f("a", "2026-10", "2026-10-05T00:00:00Z"),
      f("b", "2026-10", "2026-10-02T00:00:00Z"),
      f("c", "2026-10", "2026-10-09T00:00:00Z", true),
      f("b", "2026-11", "2026-11-02T00:00:00Z"),
      f("a", "2026-11", "2026-11-01T00:00:00Z"),
    ]);
    expect(rows.map((r) => [r.userId, r.finished, r.mastered])).toEqual([["b", 2, 0], ["a", 2, 0], ["c", 1, 1]]);
  });
});
