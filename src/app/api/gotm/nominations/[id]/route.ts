import { z } from "zod";
import { sameOrigin } from "@/lib/auth/http";
import { getUser } from "@/lib/auth/session";
import { currentCycle, removeNomination } from "@/lib/gotm-db";

/** Withdraws your own nomination before voting opens, or removes any nomination as an admin. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/gotm/nominations/[id]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const user = await getUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Not found" }, { status: 404 });
  const removed = await removeNomination(id, user, await currentCycle());
  if (!removed) return Response.json({ error: "That nomination can't be withdrawn now." }, { status: 403 });
  return Response.json({ ok: true });
}
