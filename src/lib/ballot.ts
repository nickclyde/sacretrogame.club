import { z } from "zod";
import { LIBRARY_IDS } from "@/data/libraries";
import { SLOT_IDS, WEEK_IDS } from "@/data/polls";

const ranking = (ids: string[]) =>
  z
    .array(z.enum(ids as [string, ...string[]]))
    .max(ids.length)
    .refine((r) => new Set(r).size === r.length, "Each option can only be ranked once");

const minutes = z.number().int().min(0).max(600);

export const driveMinutesSchema = z.partialRecord(
  z.enum(LIBRARY_IDS as [string, ...string[]]),
  z.object({ weeknight: minutes, weekend: minutes }),
);

export const ballotSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(40),
    slots: ranking(SLOT_IDS),
    weeks: ranking(WEEK_IDS),
    libraries: ranking(LIBRARY_IDS),
    driveMinutes: driveMinutesSchema.nullable().default(null),
  })
  .refine((b) => b.slots.length + b.weeks.length + b.libraries.length > 0, "Rank at least one option");

export type DriveMinutes = z.infer<typeof driveMinutesSchema>;
export type BallotInput = z.infer<typeof ballotSchema>;
export type Ballot = BallotInput & { updatedAt: string };

/** "  @PixelPete " and "pixelpete" are the same voter. */
export function nameKey(name: string) {
  return name.trim().replace(/^@+/, "").toLowerCase().replace(/\s+/g, " ");
}
