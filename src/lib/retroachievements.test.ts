import { describe, expect, it } from "vitest";
import { parseAwards, parseRaGameIds, raGameIdFromUrl } from "./retroachievements";

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
