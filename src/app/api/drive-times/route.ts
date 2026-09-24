import { z } from "zod";
import { votingIsClosed } from "@/data/polls";
import { driveTimes, geocode } from "@/lib/google";
import { clientIp, rateLimiter } from "@/lib/rate-limit";

const body = z.object({ address: z.string().trim().min(5).max(200) });

// Per-instance limiter. The hard ceiling is the daily quota cap on the API key.
const allowed = rateLimiter(8, 60 * 60 * 1000);

export async function POST(request: Request) {
  // Lookups only exist to help fill in a ballot.
  if (votingIsClosed()) return Response.json({ error: "Voting has closed." }, { status: 403 });

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return Response.json({ error: "Drive times are not set up yet." }, { status: 503 });

  if (!allowed(clientIp(request))) return Response.json({ error: "Too many lookups. Try again in an hour." }, { status: 429 });

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
