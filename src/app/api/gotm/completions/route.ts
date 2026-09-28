import { after } from "next/server";
import { z } from "zod";
import { sameOrigin } from "@/lib/auth/http";
import { getUser } from "@/lib/auth/session";
import { announceGotm } from "@/lib/discord";
import { claimShoutOut, finishMonths, setHonorFinish } from "@/lib/finishers";

const body = z.object({ month: z.string(), done: z.boolean() });

/** Ticks or unticks "I finished it" for a month's game, on the honor system. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const user = await getUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (!user.displayName) return Response.json({ error: "Pick a display name on your account page first." }, { status: 400 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

  // Any month with a game counts, including past ones, so late finishes still make the board.
  const month = (await finishMonths()).find((m) => m.key === parsed.data.month);
  if (!month) return Response.json({ error: "There's no game for that month." }, { status: 404 });

  if ((await setHonorFinish(month.key, user.id, parsed.data.done)) === "ra") {
    return Response.json({ error: "RetroAchievements shows you beat it, so it stays on the board." }, { status: 409 });
  }
  if (parsed.data.done) {
    const message = await claimShoutOut(month, user.id);
    if (message) after(() => announceGotm(message));
  }
  return Response.json({ ok: true });
}
