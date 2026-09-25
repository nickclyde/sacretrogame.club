import { describe, expect, it } from "vitest";
import { siteName, webUrl } from "./links";

describe("webUrl", () => {
  it("normalizes http(s) links", () => {
    expect(webUrl(" https://en.wikipedia.org/wiki/Chrono_Trigger ")).toBe("https://en.wikipedia.org/wiki/Chrono_Trigger");
    expect(webUrl("http://example.com")).toBe("http://example.com/");
  });

  it("rejects other schemes, credentials, and bare hosts", () => {
    expect(webUrl("javascript:alert(1)")).toBeNull();
    expect(webUrl("data:text/html,hi")).toBeNull();
    expect(webUrl("https://user:pass@example.com")).toBeNull();
    expect(webUrl("https://localhost")).toBeNull();
    expect(webUrl("not a url")).toBeNull();
  });
});

describe("siteName", () => {
  it("names known sites and falls back to the host", () => {
    expect(siteName("https://en.wikipedia.org/wiki/Tetris")).toBe("Wikipedia");
    expect(siteName("https://www.mobygames.com/game/4501")).toBe("mobygames.com");
  });
});
