import type { Cover } from "./gotm";

// Wikimedia asks API clients to identify themselves.
export const WIKIMEDIA_HEADERS = { "User-Agent": "SacRetroGameClub/1.0 (https://sacretrogame.club)" };
const IMAGE_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);

export type WikiImage = { source: string; width: number; height: number };

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

function asCover(image: WikiImage | undefined): Cover | null {
  if (!image?.source || !image.width || !image.height) return null;
  const url = new URL(image.source);
  if (!IMAGE_HOSTS.has(url.hostname)) return null;
  url.search = ""; // Only tracking parameters.
  return { src: url.href, width: image.width, height: image.height };
}

/**
 * An article's lead image as a Cover. Box art on Wikipedia is small, so the original is sharpest,
 * but a free image from Commons can be huge, and an SVG won't show; the thumbnail is always a
 * modest raster.
 */
export function pageCover(original: WikiImage | undefined, thumbnail: WikiImage | undefined): Cover | null {
  const usable = original?.source && original.width <= 1000 && !/\.svg$/i.test(new URL(original.source).pathname);
  return asCover(usable ? original : undefined) ?? asCover(thumbnail);
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
  const res = await fetch(api, { headers: WIKIMEDIA_HEADERS, signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const page = (await res.json()) as { originalimage?: WikiImage; thumbnail?: WikiImage };
  return pageCover(page.originalimage, page.thumbnail);
}
