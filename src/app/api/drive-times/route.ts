import { z } from "zod";
import { driveTimes, geocode } from "@/lib/google";

const body = z.object({ address: z.string().trim().min(5).max(200) });

// Per-instance limiter. The hard ceiling is the daily quota cap on the API key.
const LIMIT = 8;
const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

function allowed(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return false;
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

export async function POST(request: Request) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return Response.json({ error: "Drive times are not set up yet." }, { status: 503 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!allowed(ip)) return Response.json({ error: "Too many lookups. Try again in an hour." }, { status: 429 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a street address or ZIP code." }, { status: 400 });

  // The address is used for this lookup only. It is never stored or logged.
  try {
    const origin = await geocode(parsed.data.address, key);
    if (!origin) return Response.json({ error: "Couldn't find that address. Try adding the city or ZIP." }, { status: 404 });
    const minutes = await driveTimes(origin, key);
    return Response.json({ origin, minutes });
  } catch {
    return Response.json({ error: "Drive time lookup failed. Try again in a minute." }, { status: 502 });
  }
}
