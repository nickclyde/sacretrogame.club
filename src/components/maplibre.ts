import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";

// See scripts/copy-map-worker.mjs.
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
export const DARK_MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

export { maplibregl };
