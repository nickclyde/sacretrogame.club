import { after } from "next/server";
import { z } from "zod";
import { sameOrigin, seeOther } from "@/lib/auth/http";
import { getUser } from "@/lib/auth/session";
import { announceGotm } from "@/lib/discord";
import { linkRa, syncRa, unlinkRa } from "@/lib/finishers";
import { clientIp, rateLimiter } from "@/lib/rate-limit";
import { RaError, raConfigured, resolveUser } from "@/lib/retroachievements";

// RA usernames are letters and numbers. Allowing a little more costs nothing, since it only goes
// into a query string.
const username = z.string().trim().regex(/^[A-Za-z0-9_.-]{2,32}$/);
const allow = rateLimiter(10, 10 * 60 * 1000);

/** Links, checks, or unlinks a member's RetroAchievements account from the account page. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const user = await getUser();
  if (!user) return seeOther(request, "/sign-in?next=/account");
  if (!raConfigured()) return seeOther(request, "/account");
  const form = await request.formData();
  const action = form.get("action")?.toString();

  if (action === "unlink") {
    await unlinkRa(user.id);
    return seeOther(request, "/account?ra=unlinked");
  }
  if (action !== "link" && action !== "check") return seeOther(request, "/account");
  if (!allow(clientIp(request))) return seeOther(request, "/account?error=ra-busy");

  try {
    if (action === "link") {
      const parsed = username.safeParse(form.get("username")?.toString());
      if (!parsed.success) return seeOther(request, "/account?error=ra-unknown");
      const ra = await resolveUser(parsed.data);
      if (!ra) return seeOther(request, "/account?error=ra-unknown");
      if (!(await linkRa(user.id, ra))) return seeOther(request, "/account?error=ra-taken");
    }
    const messages = await syncRa(user.id);
    after(async () => {
      for (const message of messages) await announceGotm(message);
    });
    return seeOther(request, `/account?ra=${action === "link" ? "linked" : "checked"}`);
  } catch (e) {
    if (!(e instanceof RaError)) console.error("RetroAchievements link failed", e);
    return seeOther(request, "/account?error=ra-down");
  }
}
