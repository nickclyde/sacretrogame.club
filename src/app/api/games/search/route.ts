import { getUser } from "@/lib/auth/session";
import { rateLimiter } from "@/lib/rate-limit";
import { searchGames } from "@/lib/wikidata";

// Wikidata and Wikipedia are free to use, so keep each member's share of them modest.
const allowed = rateLimiter(60, 60 * 1000);

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Sign in to search." }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 80) return Response.json({ games: [] });
  if (!allowed(user.id)) return Response.json({ error: "Slow down a little and try again." }, { status: 429 });
  try {
    return Response.json({ games: await searchGames(q) });
  } catch (e) {
    console.error("Game search failed", e);
    return Response.json({ error: "Game search isn't working right now. Enter the game by hand." }, { status: 502 });
  }
}
