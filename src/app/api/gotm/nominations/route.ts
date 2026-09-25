import { after } from "next/server";
import { z } from "zod";
import { PITCH_MAX } from "@/data/gotm";
import { sameOrigin } from "@/lib/auth/http";
import { getUser } from "@/lib/auth/session";
import { announceGotm, nominationMessage } from "@/lib/discord";
import { addNomination, currentCycle, listNominations, type NewNomination } from "@/lib/gotm-db";
import { webUrl } from "@/lib/links";
import { getGame } from "@/lib/wikidata";
import { wikipediaCover } from "@/lib/wikipedia";

const pitch = z.string().trim().max(PITCH_MAX).transform((s) => s || null).nullable().default(null);
const platform = z.string().trim().min(1, "Pick a platform").max(40);
const url = z
  .string()
  .trim()
  .max(500, "That link is too long")
  .transform((s, ctx) => {
    if (!s) return null;
    const href = webUrl(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
    if (!href) ctx.addIssue({ code: "custom", message: "Enter a web address, like https://en.wikipedia.org/wiki/..." });
    return href;
  })
  .nullable()
  .default(null);

const fromSearch = z.object({ wikidataId: z.string().regex(/^Q\d+$/, "Pick a game from the search results"), platform, pitch });
const byHand = z.object({
  title: z.string().trim().min(1, "Enter the game's title").max(120),
  platform,
  year: z.number().int().min(1950).max(2100).nullable().default(null),
  url,
  pitch,
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const user = await getUser();
  if (!user) return Response.json({ error: "Sign in to nominate a game." }, { status: 401 });
  if (!user.displayName) return Response.json({ error: "Pick a display name on your account page first." }, { status: 400 });

  const cycle = await currentCycle();
  if (cycle.phase !== "nominating") {
    return Response.json({ error: "Nominations are closed while voting is underway." }, { status: 403 });
  }
  const raw = await request.json().catch(() => null);
  // Pick the schema up front: a union would report "Invalid input" instead of the field's message.
  const parsed = (raw && typeof raw === "object" && "wikidataId" in raw ? fromSearch : byHand).safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid nomination" }, { status: 400 });
  }

  let input: NewNomination;
  const data = parsed.data;
  if ("wikidataId" in data) {
    // Game details come from Wikidata, not the browser.
    const game = await getGame(data.wikidataId).catch(() => null);
    if (!game) return Response.json({ error: "Couldn't look up that game. Try again, or enter it by hand." }, { status: 502 });
    if (game.platforms.length > 0 && !game.platforms.includes(data.platform)) {
      return Response.json({ error: "Pick one of the game's platforms." }, { status: 400 });
    }
    input = {
      wikidataId: game.wikidataId,
      title: game.title,
      platform: data.platform,
      year: game.year,
      cover: game.cover,
      infoUrl: game.url,
      pitch: data.pitch,
    };
  } else {
    // A Wikipedia link doubles as the source of box art. A failed lookup just means no art.
    const cover = data.url ? await wikipediaCover(data.url).catch(() => null) : null;
    input = { wikidataId: null, title: data.title, platform: data.platform, year: data.year, cover, infoUrl: data.url, pitch: data.pitch };
  }

  const result = await addNomination(cycle.key, user.id, input);
  if ("error" in result) {
    const error =
      result.error === "limit"
        ? "You've used both of your nominations this month. Withdraw one to swap it out."
        : `${result.by} already nominated that one.`;
    return Response.json({ error }, { status: 409 });
  }
  after(async () => announceGotm(nominationMessage(cycle.key, result.nomination, (await listNominations(cycle.key)).length)));
  return Response.json({ nomination: result.nomination });
}
