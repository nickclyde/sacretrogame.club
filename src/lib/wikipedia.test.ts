import { afterEach, describe, expect, it, vi } from "vitest";
import { wikipediaArticle, wikipediaCover } from "./wikipedia";

describe("wikipediaArticle", () => {
  it("reads the language and title, including mobile links", () => {
    expect(wikipediaArticle("https://en.wikipedia.org/wiki/Chrono_Trigger")).toEqual({ lang: "en", title: "Chrono_Trigger" });
    expect(wikipediaArticle("https://ja.m.wikipedia.org/wiki/%E3%82%AF%E3%83%AD%E3%83%8E")).toEqual({ lang: "ja", title: "クロノ" });
  });

  it("ignores other sites and non-article pages", () => {
    expect(wikipediaArticle("https://www.mobygames.com/game/4501")).toBeNull();
    expect(wikipediaArticle("https://en.wikipedia.org/w/index.php?title=Chrono_Trigger")).toBeNull();
    expect(wikipediaArticle("https://en.wikipedia.org.evil.example/wiki/X")).toBeNull();
  });
});

describe("wikipediaCover", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubSummary(page: object) {
    const fetch = vi.fn<(url: string) => Promise<Response>>(async () => Response.json(page));
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  it("uses the original image without tracking parameters", async () => {
    const fetch = stubSummary({
      originalimage: { source: "https://upload.wikimedia.org/wikipedia/en/a/a7/Chrono_Trigger.jpg?utm_source=x", width: 370, height: 270 },
    });
    expect(await wikipediaCover("https://en.wikipedia.org/wiki/Chrono_Trigger")).toEqual({
      src: "https://upload.wikimedia.org/wikipedia/en/a/a7/Chrono_Trigger.jpg",
      width: 370,
      height: 270,
    });
    expect(fetch.mock.calls[0][0]).toBe("https://en.wikipedia.org/api/rest_v1/page/summary/Chrono_Trigger");
  });

  it("falls back to the thumbnail when the original is an SVG", async () => {
    stubSummary({
      originalimage: { source: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Logo.svg", width: 512, height: 200 },
      thumbnail: { source: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Logo.svg/330px-Logo.svg.png", width: 330, height: 129 },
    });
    expect(await wikipediaCover("https://en.wikipedia.org/wiki/Tetris")).toMatchObject({ width: 330, height: 129 });
  });

  it("skips images hosted anywhere else, and non-Wikipedia links", async () => {
    const fetch = stubSummary({ originalimage: { source: "https://example.com/a.jpg", width: 1, height: 1 } });
    expect(await wikipediaCover("https://en.wikipedia.org/wiki/X")).toBeNull();
    expect(await wikipediaCover("https://example.com/wiki/X")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
