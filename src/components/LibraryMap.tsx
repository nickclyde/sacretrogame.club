"use client";

import { useState } from "react";
import { Map, Marker, NavigationControl, Popup } from "react-map-gl/maplibre";
import { LIBRARIES, directionsUrl, fullAddress } from "@/data/libraries";
import type { DriveMinutes } from "@/lib/ballot";
import { MAP_STYLE, maplibregl } from "./maplibre";

type Props = {
  ranking: string[];
  home: { lat: number; lng: number } | null;
  minutes: DriveMinutes | null;
  onRank?: (id: string) => void;
};

export default function LibraryMap({ ranking, home, minutes, onRank }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = LIBRARIES.find((l) => l.id === openId);

  return (
    <div className="pixel-box h-[420px] overflow-hidden">
      <Map
        mapLib={maplibregl}
        initialViewState={{ bounds: [-121.56, 38.43, -121.24, 38.69], fitBoundsOptions: { padding: 40 } }}
        mapStyle={MAP_STYLE}
        cooperativeGestures
        attributionControl={{ compact: true }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {LIBRARIES.map((l) => {
          const place = ranking.indexOf(l.id);
          return (
            <Marker key={l.id} longitude={l.lng} latitude={l.lat} anchor="center" onClick={(e) => { e.originalEvent.stopPropagation(); setOpenId(l.id); }}>
              <button
                type="button"
                aria-label={l.name}
                className={`grid h-8 min-w-8 cursor-pointer place-items-center border-[3px] border-ink px-1 font-pixel text-lg shadow-[3px_3px_0_var(--ink)] ${place >= 0 ? "bg-yellow text-ink" : "bg-purple text-white"}`}
              >
                {place >= 0 ? place + 1 : "?"}
              </button>
            </Marker>
          );
        })}
        {home && (
          <Marker longitude={home.lng} latitude={home.lat} anchor="center">
            <span className="block border-[3px] border-ink bg-red px-1.5 font-pixel text-white shadow-[3px_3px_0_var(--ink)]">You</span>
          </Marker>
        )}
        {open && (
          <Popup longitude={open.lng} latitude={open.lat} offset={20} closeButton={false} onClose={() => setOpenId(null)} maxWidth="260px">
            <p className="text-base font-bold leading-snug">{open.name}</p>
            <p className="text-sm text-muted">{fullAddress(open)}</p>
            {minutes?.[open.id] && (
              <p className="mt-1 text-sm">
                {minutes[open.id]!.weeknight} min on a weeknight, {minutes[open.id]!.weekend} min on Saturday
              </p>
            )}
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a className="underline" href={directionsUrl(open)} target="_blank" rel="noreferrer">Directions</a>
              {onRank && !ranking.includes(open.id) && (
                <button type="button" className="cursor-pointer underline" onClick={() => onRank(open.id)}>
                  Add to my ranking
                </button>
              )}
            </p>
          </Popup>
        )}
      </Map>
    </div>
  );
}
