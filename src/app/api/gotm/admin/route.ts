import { z } from "zod";
import { sameOrigin } from "@/lib/auth/http";
import { getUser } from "@/lib/auth/session";
import { finishMonths } from "@/lib/finishers";
import { currentCycle, resetVoteTimes, setRaGameIds, setVoteTimes } from "@/lib/gotm-db";
import { parseRaGameIds } from "@/lib/retroachievements";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["open-now", "close-now", "reset"]) }),
  z.object({ action: z.literal("ra-games"), month: z.string(), games: z.string().max(500) }),
]);

/**
 * Lets a host open or close the vote by hand during the meetup, or go back to the schedule, and
 * pick which RetroAchievements sets count toward a month's leaderboard.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const user = await getUser();
  if (!user?.isAdmin) return Response.json({ error: "Admins only." }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Unknown action" }, { status: 400 });

  if (parsed.data.action === "ra-games") {
    const { month, games } = parsed.data;
    if (!(await finishMonths()).some((m) => m.key === month)) {
      return Response.json({ error: "There's no game for that month." }, { status: 404 });
    }
    const ids = parseRaGameIds(games);
    if (!ids) return Response.json({ error: "Use RetroAchievements game numbers or links, separated by commas." }, { status: 400 });
    await setRaGameIds(month, ids);
    return Response.json({ ok: true });
  }

  const cycle = await currentCycle();
  const now = new Date();
  switch (parsed.data.action) {
    case "open-now":
      if (cycle.phase !== "nominating") return Response.json({ error: "Voting is already open or closed." }, { status: 409 });
      await setVoteTimes(cycle.key, { opensAt: now });
      break;
    case "close-now":
      if (cycle.phase !== "voting") return Response.json({ error: "Voting isn't open." }, { status: 409 });
      await setVoteTimes(cycle.key, { closesAt: now });
      break;
    case "reset":
      await resetVoteTimes(cycle.key);
      break;
  }
  return Response.json({ ok: true });
}
