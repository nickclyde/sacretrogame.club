"use client";

import { useSyncExternalStore } from "react";
import { Map, Marker, NavigationControl } from "react-map-gl/maplibre";
import type { Library } from "@/data/libraries";
import { currentTheme, subscribeTheme } from "@/lib/theme";
import { DARK_MAP_STYLE, MAP_STYLE, maplibregl } from "./maplibre";

export default function VenueMapCanvas({ library }: { library: Library }) {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "light");
  return (
    <div className="themed-map pixel-box h-[320px] overflow-hidden">
      <Map
        mapLib={maplibregl}
        initialViewState={{ longitude: library.lng, latitude: library.lat, zoom: 13 }}
        mapStyle={theme === "dark" ? DARK_MAP_STYLE : MAP_STYLE}
        cooperativeGestures
        attributionControl={{ compact: true }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Marker longitude={library.lng} latitude={library.lat} anchor="bottom">
          <span className="block border-[3px] border-ink bg-yellow px-1.5 font-pixel text-lg text-ink shadow-[3px_3px_0_var(--shadow)]">
            {library.name}
          </span>
        </Marker>
      </Map>
    </div>
  );
}
