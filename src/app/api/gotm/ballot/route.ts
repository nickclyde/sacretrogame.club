import { z } from "zod";
import { sameOrigin } from "@/lib/auth/http";
import { getUser } from "@/lib/auth/session";
import { syncCycle } from "@/lib/gotm-announce";
import { currentCycle, listNominations, saveGameBallot } from "@/lib/gotm-db";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const user = await getUser();
  if (!user) return Response.json({ error: "Sign in to vote." }, { status: 401 });
  if (!user.displayName) return Response.json({ error: "Pick a display name on your account page first." }, { status: 400 });

  const cycle = await currentCycle();
  await syncCycle(cycle);
  if (cycle.phase !== "voting") {
    return Response.json({ error: cycle.phase === "closed" ? "Voting has closed." : "Voting hasn't opened yet." }, { status: 403 });
  }

  const ids = (await listNominations(cycle.key)).map((n) => n.id);
  const body = z.object({
    ranking: z
      .array(z.enum(ids as [string, ...string[]], "A game on your ballot was taken off. Reload the page and try again."))
      .min(1, "Rank at least one game")
      .max(ids.length)
      .refine((r) => new Set(r).size === r.length, "Each game can only be ranked once"),
  });
  const parsed = ids.length ? body.safeParse(await request.json().catch(() => null)) : null;
  if (!parsed?.success) {
    // A nomination removed mid-vote shows up here as an unknown id; reloading the ballot fixes it.
    return Response.json({ error: parsed?.error.issues[0]?.message ?? "There's nothing to vote on." }, { status: 400 });
  }
  await saveGameBallot(cycle.key, user.id, parsed.data.ranking);
  return Response.json({ ok: true });
}
