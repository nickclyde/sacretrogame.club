import { describe, expect, it } from "vitest";
import { parseAwards, parseProgress, parseRaGameIds, raGameIdFromUrl } from "./retroachievements";

describe("parseAwards", () => {
  it("keeps beaten and mastery awards with their mode and time", () => {
    const body = {
      TotalAwardsCount: 4,
      VisibleUserAwards: [
        { AwardedAt: "2016-12-30T01:55:44+00:00", AwardType: "Game Beaten", AwardData: 355, AwardDataExtra: 1 },
        { AwardedAt: "2016-12-31T01:24:11+00:00", AwardType: "Mastery/Completion", AwardData: 355, AwardDataExtra: 0 },
        { AwardedAt: "2017-01-01T00:00:00+00:00", AwardType: "Event", AwardData: 12, AwardDataExtra: 0 },
        { AwardedAt: "not a date", AwardType: "Game Beaten", AwardData: 319, AwardDataExtra: 1 },
      ],
    };
    expect(parseAwards(body)).toEqual([
      { gameId: 355, kind: "beaten", hardcore: true, at: new Date("2016-12-30T01:55:44Z") },
      { gameId: 355, kind: "mastered", hardcore: false, at: new Date("2016-12-31T01:24:11Z") },
    ]);
  });

  it("returns nothing for an unexpected body", () => {
    expect(parseAwards(null)).toEqual([]);
    expect(parseAwards([])).toEqual([]);
  });
});

describe("parseProgress", () => {
  const since = new Date("2026-09-10T01:00:00Z");

  // Trimmed from a real API_GetGameInfoAndUserProgress response for A Link to the Past (355).
  it("counts steps toward beaten and achievements earned since the pick", () => {
    const body = {
      ID: 355,
      NumAchievements: 109,
      Achievements: {
        // Earned before the pick.
        944: { ID: 944, Title: "Fighter", Type: "progression", BadgeName: "129299", DateEarned: "2026-09-03 17:51:02" },
        // Earned in softcore before the pick, then again in hardcore after it.
        2192: {
          ID: 2192,
          Title: "Sanctuary",
          Type: "progression",
          BadgeName: "129270",
          DateEarned: "2026-08-01 10:00:00",
          DateEarnedHardcore: "2026-10-03 18:02:48",
        },
        2282: { ID: 2282, Title: "Icy", Type: "progression", BadgeName: "129311" },
        2389: { ID: 2389, Title: "The Golden Age", Type: "win_condition", BadgeName: "129284" },
        943: { ID: 943, Title: "Illuminating", Type: "missable", BadgeName: "129304", DateEarned: "2026-10-03 17:56:19" },
        319714: { ID: 319714, Title: "Spider Bonus", Type: null, BadgeName: "356499", DateEarned: "2026-10-04 21:04:29" },
      },
    };
    expect(parseProgress(body, since)).toEqual({
      stepsDone: 1,
      stepsTotal: 4,
      beatable: true,
      earned: 3,
      total: 6,
      last: { title: "Spider Bonus", badge: "356499", at: new Date("2026-10-04T21:04:29Z") },
    });
  });

  it("counts the win condition as one step", () => {
    const body = {
      Achievements: {
        1: { Title: "Ending A", Type: "win_condition", BadgeName: "1", DateEarned: "2026-10-05 00:00:00" },
        2: { Title: "Ending B", Type: "win_condition", BadgeName: "2" },
        3: { Title: "Midway", Type: "progression", BadgeName: "3" },
      },
    };
    expect(parseProgress(body, since)).toMatchObject({ stepsDone: 1, stepsTotal: 2, earned: 1, total: 3 });
  });

  it("uses every achievement as a step when the set has no progression tags", () => {
    const body = {
      Achievements: {
        1: { Title: "One", type: null, BadgeName: "1", DateEarned: "2026-10-05 00:00:00" },
        2: { Title: "Two", type: "missable", BadgeName: "2" },
      },
    };
    expect(parseProgress(body, since)).toMatchObject({ stepsDone: 1, stepsTotal: 2, beatable: false, earned: 1, total: 2 });
  });

  it("returns null for an unexpected body", () => {
    expect(parseProgress(null, since)).toBeNull();
    expect(parseProgress({ VisibleUserAwards: [] }, since)).toBeNull();
  });
});

describe("game ids", () => {
  it("come from RA game links", () => {
    expect(raGameIdFromUrl("https://retroachievements.org/game/355")).toBe(355);
    expect(raGameIdFromUrl("retroachievements.org/game/355/")).toBe(355);
    expect(raGameIdFromUrl("https://retroachievements.org/game/355?tab=x")).toBe(355);
    expect(raGameIdFromUrl("https://retroachievements.org/user/355")).toBeNull();
    expect(raGameIdFromUrl("https://example.com/retroachievements.org/game/355")).toBeNull();
  });

  it("are parsed from a host's list of numbers and links", () => {
    expect(parseRaGameIds("355, https://retroachievements.org/game/319 355")).toEqual([355, 319]);
    expect(parseRaGameIds("  ")).toEqual([]);
    expect(parseRaGameIds("355, zelda")).toBeNull();
  });
});
