import type { Cover } from "./gotm";

// Wikimedia asks API clients to identify themselves.
const HEADERS = { "Api-User-Agent": "SacRetroGameClub/1.0 (https://sacretrogame.club)" };
const IMAGE_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);

type Image = { source: string; width: number; height: number };

/** The language and title of a Wikipedia article link, or null if it isn't one. */
export function wikipediaArticle(href: string): { lang: string; title: string } | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const host = url.hostname.match(/^([a-z][a-z-]*)\.(?:m\.)?wikipedia\.org$/);
  if (!host || !url.pathname.startsWith("/wiki/")) return null;
  let title: string;
  try {
    title = decodeURIComponent(url.pathname.slice("/wiki/".length));
  } catch {
    return null;
  }
  return title ? { lang: host[1], title } : null;
}

function asCover(image: Image | undefined): Cover | null {
  if (!image?.source || !image.width || !image.height) return null;
  const url = new URL(image.source);
  if (!IMAGE_HOSTS.has(url.hostname)) return null;
  url.search = ""; // Only tracking parameters.
  return { src: url.href, width: image.width, height: image.height };
}

/**
 * The lead image of a Wikipedia article, which for a game is usually its box art. Only ever
 * calls Wikipedia's own API, never the link itself, so a nomination can't point the server
 * at an arbitrary address.
 */
export async function wikipediaCover(href: string): Promise<Cover | null> {
  const article = wikipediaArticle(href);
  if (!article) return null;
  const api = `https://${article.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article.title)}`;
  const res = await fetch(api, { headers: HEADERS, signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const page = (await res.json()) as { originalimage?: Image; thumbnail?: Image };
  // The original can be an SVG, which next/image won't serve; the thumbnail is always a raster.
  const original = page.originalimage?.source && !/\.svg$/i.test(new URL(page.originalimage.source).pathname) ? page.originalimage : undefined;
  return asCover(original) ?? asCover(page.thumbnail);
}
