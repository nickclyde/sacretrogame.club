import { describe, expect, it } from "vitest";
import type { Ballot } from "./ballot";
import { ballotMessage, nominationMessage, votingOpenMessage, winnerMessage } from "./discord";
import { gotmCycle, gotmResults, type Nomination } from "./gotm";

const ballot = (name: string, slots: string[], weeks: string[], libraries: string[]): Ballot => ({
  name, slots, weeks, libraries, driveMinutes: null, updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("ballotMessage", () => {
  it("announces a first ballot with the headline", () => {
    const msg = ballotMessage([], ballot("Ana", ["wed-18"], ["w3"], ["arcade"]));
    expect(msg).toContain("**Ana** voted, that's ballot #1");
    expect(msg).toContain("**3rd Wednesday, 6 to 8 PM at Arcade Library**");
    expect(msg).toContain("**Library:** Arcade Library with 1 of 1 in the first round");
  });

  it("flags a change of leader and the runner-up", () => {
    const previous = [ballot("Ana", ["wed-18"], ["w3"], ["arcade"])];
    const msg = ballotMessage(previous, ballot("Bo", ["sat-13"], ["w3"], ["arcade"]));
    expect(msg).toContain("Wednesday, 6 to 8 PM with 1 of 2, tied with Saturday, 1 to 3 PM");
    expect(msg).not.toContain("New leader");
    const third = ballotMessage([...previous, ballot("Bo", ["sat-13"], [], [])], ballot("Cy", ["sat-13"], [], []));
    expect(third).toContain("New leader, it was Wednesday, 6 to 8 PM");
  });

  it("treats a repeat name as an update, not a new ballot", () => {
    const previous = [ballot("Ana", ["wed-18"], [], [])];
    const msg = ballotMessage(previous, ballot("@ana", ["thu-18"], [], []));
    expect(msg).toContain("changed their ballot (1 total)");
    expect(msg).toContain("New leader, it was Wednesday");
  });

  it("neutralizes markdown and mentions in names", () => {
    expect(ballotMessage([], ballot("@everyone **hi**", ["wed-18"], [], []))).toContain("\\@everyone \\*\\*hi\\*\\*");
  });
});

describe("game of the month messages", () => {
  const nom = (id: string, title: string, extra: Partial<Nomination> = {}): Nomination => ({
    id, userId: "u", nominator: "Ana", igdbId: null, title, platform: "SNES", year: 1995, cover: null, infoUrl: null, pitch: null, ...extra,
  });

  it("announces a nomination with its pitch, escaped", () => {
    const msg = nominationMessage("2026-11", nom("a", "Chrono Trigger", { nominator: "@here", pitch: "Time\ntravel **rules**" }), 3);
    expect(msg).toContain("🎮 **\\@here** nominated **Chrono Trigger** (SNES, 1995) for November's game of the month");
    expect(msg).toContain("> Time travel \\*\\*rules\\*\\*");
    expect(msg).toContain("3 nominations so far");
  });

  it("links the title to its IGDB page without an embed", () => {
    const msg = nominationMessage("2026-11", nom("a", "Chrono Trigger", { infoUrl: "https://www.igdb.com/games/chrono-trigger" }), 1);
    expect(msg).toContain("nominated **[Chrono Trigger](<https://www.igdb.com/games/chrono-trigger>)** (SNES, 1995)");
  });

  it("links other sites too, encoding parentheses", () => {
    const msg = nominationMessage("2026-11", nom("a", "Tetris", { infoUrl: "https://en.wikipedia.org/wiki/Tetris_(Game_Boy_video_game)" }), 1);
    expect(msg).toContain("**[Tetris](<https://en.wikipedia.org/wiki/Tetris_%28Game_Boy_video_game%29>)**");
  });

  it("does not link anything but http(s)", () => {
    const msg = nominationMessage("2026-11", nom("a", "Chrono Trigger", { infoUrl: "javascript:alert(1)" }), 1);
    expect(msg).toContain("nominated **Chrono Trigger** (SNES, 1995)");
  });

  it("leaves out a missing year and pitch", () => {
    const msg = nominationMessage("2026-11", nom("a", "Homebrew", { year: null }), 1);
    expect(msg).toContain("**Homebrew** (SNES) for");
    expect(msg).not.toContain("\n> ");
    expect(msg).toContain("1 nomination so far");
  });

  it("says when voting closes", () => {
    const cycle = gotmCycle(new Date("2026-10-14T17:30:00-07:00"));
    expect(votingOpenMessage(cycle, 4)).toContain("Rank the 4 nominations by 7:45 PM");
  });

  it("names the winner with the deciding round", () => {
    const noms = [nom("a", "Chrono Trigger"), nom("b", "EarthBound", { nominator: "Bo" }), nom("c", "Super Metroid")];
    const { result } = gotmResults(noms, [["b"], ["b"], ["a", "b"], ["c", "a"], ["a"]]);
    const msg = winnerMessage("2026-11", noms.find((n) => n.id === result.winner)!, result);
    expect(msg).toContain("🏆 November's game of the month is **Chrono Trigger** (SNES, 1995), nominated by Ana!");
    expect(msg).toContain("It won with 3 of 5 ballots after 2 rounds");
  });
});
