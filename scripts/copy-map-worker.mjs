// MapLibre finds its worker relative to import.meta.url, which does not survive
// bundling. Serve the worker (and the shared chunk it imports) from /maplibre/
// instead; LibraryMap points setWorkerUrl there.
import { cp, mkdir } from "node:fs/promises";

const from = new URL("../node_modules/maplibre-gl/dist/", import.meta.url);
const to = new URL("../public/maplibre/", import.meta.url);
await mkdir(to, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await cp(new URL(f, from), new URL(f, to));
}
