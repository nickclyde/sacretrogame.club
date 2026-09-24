import type { Cover } from "./gotm";

/** Box art from IGDB's image CDN, at 2x for sharp display. */
export function coverUrl(imageId: string, size: "cover_small" | "cover_big" = "cover_big") {
  return `https://images.igdb.com/igdb/image/upload/t_${size}_2x/${imageId}.jpg`;
}

/** IGDB box art as a Cover. cover_big at 2x is always 528x748. */
export function igdbCover(imageId: string): Cover {
  return { src: coverUrl(imageId), width: 528, height: 748 };
}
