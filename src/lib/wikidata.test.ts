import { describe, expect, it } from "vitest";
import { gameTitle, isGame, rank, toGame, type Entity } from "./wikidata";

const claim = (value: unknown, rank = "normal") => ({ mainsnak: { datavalue: { value } }, rank });
const item = (id: string) => claim({ id });
const date = (time: string, rank?: string) => claim({ time }, rank);

function entity(id: string, enwiki: string | null, extra: Partial<Entity> = {}, sitelinks = 1): Entity {
  const links: Record<string, { title: string }> = enwiki ? { enwiki: { title: enwiki } } : {};
  for (let i = Object.keys(links).length; i < sitelinks; i++) links[`x${i}wiki`] = { title: enwiki ?? id };
  return { id, sitelinks: links, claims: { P31: [item("Q7889")] }, ...extra };
}

describe("toGame", () => {
  it("maps title, earliest year, short platform names, and link", () => {
    const e = entity("Q761815", "Chrono Trigger", {
      claims: {
        P31: [item("Q7889")],
        P577: [date("+2008-11-20T00:00:00Z"), date("+1995-03-11T00:00:00Z"), date("+1990-01-01T00:00:00Z", "deprecated")],
        P400: [item("Q183259"), item("Q170323"), item("Q10677"), item("Q999"), item("Q183259")],
      },
    });
    const cover = { src: "https://upload.wikimedia.org/wikipedia/en/a/a7/Chrono_Trigger.jpg", width: 370, height: 270 };
    expect(toGame(e, new Map([["Q999", "Wonder Console"]]), cover)).toEqual({
      wikidataId: "Q761815",
      title: "Chrono Trigger",
      year: 1995,
      platforms: ["DS", "PS1", "SNES", "Wonder Console"],
      cover,
      url: "https://en.wikipedia.org/wiki/Chrono_Trigger",
    });
  });

  it("tolerates missing statements and unknown platforms", () => {
    const e = entity("Q1", "Homebrew", { claims: { P31: [item("Q7889")], P400: [item("Q404")] } });
    expect(toGame(e, new Map(), null)).toMatchObject({ year: null, platforms: [], cover: null });
  });

  it("keeps colons readable and escapes the rest of the link", () => {
    expect(toGame(entity("Q2", "The Legend of Zelda: A Link to the Past"), new Map(), null).url).toBe(
      "https://en.wikipedia.org/wiki/The_Legend_of_Zelda:_A_Link_to_the_Past",
    );
    expect(toGame(entity("Q3", "Sonic & Knuckles"), new Map(), null).url).toBe("https://en.wikipedia.org/wiki/Sonic_%26_Knuckles");
  });
});

describe("gameTitle", () => {
  it("drops Wikipedia's disambiguation", () => {
    expect(gameTitle(entity("Q1", "Castlevania (1986 video game)"))).toBe("Castlevania");
  });

  it("prefers the English article title over labels", () => {
    expect(gameTitle(entity("Q2323709", "EarthBound Beginnings", { labels: { mul: { value: "Mother" } } }))).toBe("EarthBound Beginnings");
  });

  it("falls back to the English label, then the default one", () => {
    expect(gameTitle(entity("Q1", null, { labels: { en: { value: "Pulseman" }, mul: { value: "パルスマン" } } }))).toBe("Pulseman");
    expect(gameTitle(entity("Q1", null, { labels: { mul: { value: "Pulseman" } } }))).toBe("Pulseman");
  });
});

describe("isGame", () => {
  it("needs a video game with an English Wikipedia article", () => {
    expect(isGame(entity("Q1", "Chrono Trigger"))).toBe(true);
    expect(isGame(entity("Q2", null))).toBe(false);
    expect(isGame(entity("Q42", "Douglas Adams", { claims: { P31: [item("Q5")] } }))).toBe(false);
  });
});

describe("rank", () => {
  it("puts titles matching every typed word first, then the more famous game", () => {
    const skyrim = entity("Q323862", "The Elder Scrolls V: Skyrim", {}, 68);
    const mother3 = entity("Q2383167", "Mother 3", {}, 22);
    const interlude = entity("Q11287565", "Interlude (video game)", {}, 2);
    expect(rank([interlude, skyrim, mother3], "mother 3").map((e) => e.id)).toEqual(["Q2383167", "Q323862", "Q11287565"]);
  });

  it("matches half-typed words, accents, and Roman numerals", () => {
    const sf2 = entity("Q1133204", "Street Fighter II", {}, 31);
    const pokemon = entity("Q25536523", "Pokémon Red", {}, 9);
    const other = entity("Q1", "Final Fight", {}, 40);
    expect(rank([other, sf2], "street fighter 2")[0].id).toBe("Q1133204");
    expect(rank([other, pokemon], "pokemon re")[0].id).toBe("Q25536523");
  });

  it("orders matches by how many Wikipedias cover them, keeping search order for ties", () => {
    const a = entity("Qa", "Kirby's Adventure", {}, 25);
    const b = entity("Qb", "Kirby Super Star", {}, 19);
    const c = entity("Qc", "Kirby's Dream Land", {}, 25);
    expect(rank([b, a, c], "kirby").map((e) => e.id)).toEqual(["Qa", "Qc", "Qb"]);
  });
});
