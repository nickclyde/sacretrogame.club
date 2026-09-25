import { beforeEach, describe, expect, it } from "vitest";
import { signInWith } from "./auth/users";
import { resetDevDb } from "./db";
import { gotmCycle } from "./gotm";
import {
  addNomination,
  claimAnnouncement,
  currentCycle,
  getGameBallot,
  listGameBallots,
  listNominations,
  removeNomination,
  resetVoteTimes,
  saveGameBallot,
  setVoteTimes,
  storedWinner,
  type NewNomination,
} from "./gotm-db";

const KEY = "2026-11";
const game = (title: string, extra: Partial<NewNomination> = {}): NewNomination => ({
  wikidataId: null, title, platform: "SNES", year: null, cover: null, infoUrl: null, pitch: null, ...extra,
});

async function user(name: string) {
  const r = await signInWith({ provider: "discord", subject: name, email: null, displayName: name }, null);
  if (!("userId" in r)) throw new Error("sign-in failed");
  return r.userId;
}

beforeEach(() => resetDevDb());

describe("nominations", () => {
  it("allow two per person per cycle", async () => {
    const ana = await user("Ana");
    expect(await addNomination(KEY, ana, game("Chrono Trigger"))).toHaveProperty("nomination.nominator", "Ana");
    expect(await addNomination(KEY, ana, game("EarthBound"))).toHaveProperty("nomination");
    expect(await addNomination(KEY, ana, game("Super Metroid"))).toEqual({ error: "limit" });
    expect(await addNomination("2026-12", ana, game("Super Metroid"))).toHaveProperty("nomination");
  });

  it("reject a game that is already nominated, by Wikidata id or title and platform", async () => {
    const ana = await user("Ana");
    const bo = await user("Bo");
    await addNomination(KEY, ana, game("Chrono Trigger", { wikidataId: "Q761815" }));
    expect(await addNomination(KEY, bo, game("Chrono Trigger (SNES)", { wikidataId: "Q761815" }))).toEqual({ error: "duplicate", by: "Ana" });
    expect(await addNomination(KEY, bo, game("chrono trigger"))).toEqual({ error: "duplicate", by: "Ana" });
    expect(await addNomination(KEY, bo, game("Chrono Trigger", { platform: "NDS" }))).toHaveProperty("nomination");
  });

  it("can be withdrawn by their nominator only before voting, and removed by admins any time", async () => {
    const ana = await user("Ana");
    const bo = await user("Bo");
    const r = await addNomination(KEY, ana, game("Chrono Trigger"));
    if (!("nomination" in r)) throw new Error();
    const nominating = { ...gotmCycle(new Date("2026-10-01T12:00:00-07:00")), key: KEY };
    const voting = { ...nominating, phase: "voting" as const };

    expect(await removeNomination(r.nomination.id, { id: bo, isAdmin: false }, nominating)).toBe(false);
    expect(await removeNomination(r.nomination.id, { id: ana, isAdmin: false }, voting)).toBe(false);
    expect(await removeNomination(r.nomination.id, { id: bo, isAdmin: true }, voting)).toBe(true);
    expect(await listNominations(KEY)).toHaveLength(0);
    // A withdrawn slot can be used again.
    expect(await addNomination(KEY, ana, game("Chrono Trigger"))).toHaveProperty("nomination");
  });
});

describe("ballots", () => {
  it("keep one per person per cycle, replacing on save", async () => {
    const ana = await user("Ana");
    await saveGameBallot(KEY, ana, ["a", "b"]);
    await saveGameBallot(KEY, ana, ["b"]);
    expect(await getGameBallot(KEY, ana)).toEqual(["b"]);
    expect(await listGameBallots(KEY)).toEqual([{ name: "Ana", ranking: ["b"] }]);
    expect(await getGameBallot("2026-12", ana)).toBeNull();
  });
});

describe("vote times", () => {
  it("apply admin overrides to the current cycle and reset to the schedule", async () => {
    const now = new Date("2026-10-01T12:00:00-07:00");
    expect((await currentCycle(now)).phase).toBe("nominating");
    await setVoteTimes(KEY, { opensAt: new Date("2026-10-01T11:00:00-07:00") });
    expect((await currentCycle(now)).phase).toBe("voting");
    await setVoteTimes(KEY, { closesAt: new Date("2026-10-01T11:30:00-07:00") });
    expect((await currentCycle(now)).phase).toBe("closed");
    await resetVoteTimes(KEY);
    expect((await currentCycle(now)).phase).toBe("nominating");
  });
});

describe("announcements", () => {
  it("are claimed once each", async () => {
    expect(await claimAnnouncement(KEY, "opened")).toBe(true);
    expect(await claimAnnouncement(KEY, "opened")).toBe(false);
    expect(await storedWinner(KEY)).toEqual({ settled: false, winner: null });
    expect(await claimAnnouncement(KEY, "winner", null)).toBe(true);
    expect(await claimAnnouncement(KEY, "winner", null)).toBe(false);
    expect(await storedWinner(KEY)).toEqual({ settled: true, winner: null });
  });

  it("announce voting again after a reset, such as after a dry run", async () => {
    expect(await claimAnnouncement(KEY, "opened")).toBe(true);
    expect(await claimAnnouncement(KEY, "opened")).toBe(false);
    await resetVoteTimes(KEY);
    expect(await claimAnnouncement(KEY, "opened")).toBe(true);
  });

  it("remember the winning nomination, and forget it when the vote is reset", async () => {
    const ana = await user("Ana");
    const r = await addNomination(KEY, ana, game("Chrono Trigger"));
    if (!("nomination" in r)) throw new Error();
    await claimAnnouncement(KEY, "winner", r.nomination.id);
    expect((await storedWinner(KEY)).winner?.title).toBe("Chrono Trigger");
    await resetVoteTimes(KEY);
    expect(await storedWinner(KEY)).toEqual({ settled: false, winner: null });
  });
});
