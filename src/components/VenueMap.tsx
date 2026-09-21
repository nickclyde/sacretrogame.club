"use client";

import dynamic from "next/dynamic";

export const VenueMap = dynamic(() => import("./VenueMapCanvas"), {
  ssr: false,
  loading: () => <div className="pixel-box grid h-[320px] place-items-center text-muted">Loading map</div>,
});
