"use client";

import { Map, Marker, NavigationControl } from "react-map-gl/maplibre";
import type { Library } from "@/data/libraries";
import { MAP_STYLE, maplibregl } from "./maplibre";

export default function VenueMapCanvas({ library }: { library: Library }) {
  return (
    <div className="pixel-box h-[320px] overflow-hidden">
      <Map
        mapLib={maplibregl}
        initialViewState={{ longitude: library.lng, latitude: library.lat, zoom: 13 }}
        mapStyle={MAP_STYLE}
        cooperativeGestures
        attributionControl={{ compact: true }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Marker longitude={library.lng} latitude={library.lat} anchor="bottom">
          <span className="block border-[3px] border-ink bg-yellow px-1.5 font-pixel text-lg text-ink shadow-[3px_3px_0_var(--ink)]">
            {library.name}
          </span>
        </Marker>
      </Map>
    </div>
  );
}
