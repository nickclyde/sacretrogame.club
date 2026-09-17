import { LIBRARIES } from "@/data/libraries";
import type { DriveMinutes } from "./ballot";

const TZ = "America/Los_Angeles";

/** Next occurrence (strictly after today) of a weekday at a Pacific wall-clock time. */
export function nextPacific(weekday: "Wed" | "Sat", hour: number, minute: number, now = new Date()): Date {
  const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
  const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" });
  for (let i = 1; i <= 7; i++) {
    const probe = new Date(now.getTime() + i * 86_400_000);
    if (dayFmt.format(probe) !== weekday) continue;
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    for (const offset of ["-07:00", "-08:00"]) {
      const d = new Date(`${dateFmt.format(probe)}T${hh}:${mm}:00${offset}`);
      if (Number(hourFmt.format(d)) === hour) return d;
    }
  }
  throw new Error("unreachable");
}

export type Geocoded = { lat: number; lng: number; formatted: string };

export async function geocode(address: string, key: string): Promise<Geocoded | null> {
  const params = new URLSearchParams({
    address,
    key,
    components: "country:US",
    bounds: "38.2,-121.9|39.0,-120.9",
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, { cache: "no-store" });
  const data = await res.json();
  if (data.status === "ZERO_RESULTS") return null;
  if (data.status !== "OK") throw new Error(`Geocoding failed: ${data.status}`);
  const top = data.results[0];
  return { ...top.geometry.location, formatted: top.formatted_address };
}

async function matrix(origin: Geocoded, departure: Date, key: string): Promise<Record<string, number>> {
  const point = (lat: number, lng: number) => ({ waypoint: { location: { latLng: { latitude: lat, longitude: lng } } } });
  const res = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "destinationIndex,duration,condition",
    },
    body: JSON.stringify({
      origins: [point(origin.lat, origin.lng)],
      destinations: LIBRARIES.map((l) => point(l.lat, l.lng)),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE_OPTIMAL",
      departureTime: departure.toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Route matrix failed: ${res.status}`);
  const elements: { destinationIndex?: number; duration?: string; condition?: string }[] = await res.json();
  const out: Record<string, number> = {};
  for (const e of elements) {
    if (e.condition !== "ROUTE_EXISTS" || !e.duration) continue;
    out[LIBRARIES[e.destinationIndex ?? 0].id] = Math.round(parseInt(e.duration, 10) / 60);
  }
  return out;
}

/** Drive minutes to every library for a weeknight arrival (leaving 5:30 PM Wed) and a Saturday midday. */
export async function driveTimes(origin: Geocoded, key: string): Promise<DriveMinutes> {
  const [weeknight, weekend] = await Promise.all([
    matrix(origin, nextPacific("Wed", 17, 30), key),
    matrix(origin, nextPacific("Sat", 12, 30), key),
  ]);
  const out: DriveMinutes = {};
  for (const l of LIBRARIES) {
    if (weeknight[l.id] !== undefined && weekend[l.id] !== undefined) {
      out[l.id] = { weeknight: weeknight[l.id], weekend: weekend[l.id] };
    }
  }
  return out;
}
