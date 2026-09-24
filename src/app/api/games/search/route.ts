import { getUser } from "@/lib/auth/session";
import { igdbConfigured, searchGames } from "@/lib/igdb";
import { rateLimiter } from "@/lib/rate-limit";

// IGDB allows 4 requests a second for the whole site, so each member gets a modest share.
const allowed = rateLimiter(60, 60 * 1000);

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Sign in to search." }, { status: 401 });
  if (!igdbConfigured()) return Response.json({ error: "Game search isn't set up yet. Enter the game by hand." }, { status: 503 });
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 80) return Response.json({ games: [] });
  if (!allowed(user.id)) return Response.json({ error: "Slow down a little and try again." }, { status: 429 });
  try {
    return Response.json({ games: await searchGames(q) });
  } catch (e) {
    console.error("IGDB search failed", e);
    return Response.json({ error: "Game search isn't working right now. Enter the game by hand." }, { status: 502 });
  }
}
