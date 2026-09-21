export type GamePick = {
  title: string;
  platform: string;
  /** Title logo or screenshot under public/, with its pixel size. */
  image?: { src: string; width: number; height: number };
  /** Somewhere to read about the game, such as its Wikipedia article. */
  aboutUrl?: string;
  /** The game's page on retroachievements.org. */
  achievementsUrl?: string;
  /** An unusual way to play this particular game that is worth pointing out. */
  mod?: { label: string; url: string };
};

// Game of the month picks, keyed by the year and month of the meetup where the game gets
// discussed. The homepage shows the pick for the upcoming meetup, if there is one.
export const GAME_PICKS: Record<string, GamePick> = {
  "2026-10": {
    title: "The Legend of Zelda: A Link to the Past",
    platform: "SNES",
    // Public domain logotype from Wikimedia Commons (File:The Legend of Zelda A Link to the Past.png).
    image: { src: "/games/zelda-a-link-to-the-past.png", width: 484, height: 223 },
    aboutUrl: "https://en.wikipedia.org/wiki/The_Legend_of_Zelda:_A_Link_to_the_Past",
    achievementsUrl: "https://retroachievements.org/game/355",
    mod: {
      label: "an Android port with a second screen mod for dual screen handhelds",
      url: "https://github.com/samyost1/zelda3-android",
    },
  },
};
