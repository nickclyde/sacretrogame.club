/** Normalizes a user-supplied link, or returns null unless it is a plain http(s) URL. */
export function webUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || !url.hostname.includes(".")) return null;
  return url.href;
}

const SITE_NAMES: Record<string, string> = { "wikipedia.org": "Wikipedia" };

/** A short name for the site a link points to, like "Wikipedia" or "mobygames.com". */
export function siteName(href: string): string {
  const host = new URL(href).hostname.replace(/^www\./, "");
  const known = Object.keys(SITE_NAMES).find((d) => host === d || host.endsWith(`.${d}`));
  return known ? SITE_NAMES[known] : host;
}
