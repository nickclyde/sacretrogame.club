import { after } from "next/server";
import { ballotSchema } from "@/lib/ballot";
import { getBallotByName, getBallots, upsertBallot } from "@/lib/db";
import { announceBallot } from "@/lib/discord";
import { votingIsClosed } from "@/data/polls";

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name")?.trim();
  if (!name) return Response.json({ error: "Missing name" }, { status: 400 });
  const ballot = await getBallotByName(name);
  if (!ballot) return Response.json({ ballot: null });
  const { slots, weeks, libraries, updatedAt } = ballot;
  return Response.json({ ballot: { name: ballot.name, slots, weeks, libraries, updatedAt } });
}

export async function POST(request: Request) {
  if (votingIsClosed()) return Response.json({ error: "Voting has closed." }, { status: 403 });
  const parsed = ballotSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid ballot" }, { status: 400 });
  }
  const previous = await getBallots();
  await upsertBallot(parsed.data);
  after(() => announceBallot(previous, parsed.data));
  return Response.json({ ok: true });
}
