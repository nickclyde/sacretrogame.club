import { describe, expect, it } from "vitest";
import { coverUrl } from "./covers";
import { toGame } from "./igdb";

describe("toGame", () => {
  it("maps title, year, short platform names, and cover", () => {
    const game = toGame({
      id: 1029,
      name: "Chrono Trigger",
      first_release_date: 794880000,
      platforms: [
        { name: "Super Nintendo Entertainment System", abbreviation: "SNES" },
        { name: "Nintendo DS", abbreviation: "NDS" },
        { name: "Sega Mega Drive/Genesis", abbreviation: "Genesis/MegaDrive" },
        { name: "Nintendo DS", abbreviation: "NDS" },
      ],
      cover: { image_id: "co3plw" },
      url: "https://www.igdb.com/games/chrono-trigger",
      game_type: { type: "Main Game" },
    });
    expect(game).toEqual({
      igdbId: 1029,
      title: "Chrono Trigger",
      year: 1995,
      platforms: ["Genesis", "NDS", "SNES"],
      coverImageId: "co3plw",
      url: "https://www.igdb.com/games/chrono-trigger",
    });
  });

  it("tolerates missing fields", () => {
    expect(toGame({ id: 1, name: "Homebrew" })).toMatchObject({ year: null, platforms: [], coverImageId: null, url: null });
  });

  it("skips add-ons and bundles", () => {
    expect(toGame({ id: 2, name: "Map Pack", game_type: { type: "DLC" } })).toBeNull();
    expect(toGame({ id: 3, name: "Collection", game_type: { type: "Bundle" } })).toBeNull();
    expect(toGame({ id: 4, name: "Remake", game_type: { type: "Remake" } })).not.toBeNull();
  });

  it("builds cover urls", () => {
    expect(coverUrl("co3plw")).toBe("https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3plw.jpg");
  });
});
