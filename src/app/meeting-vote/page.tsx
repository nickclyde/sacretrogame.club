import Link from "next/link";
import { Ballot } from "@/components/Ballot";
import { votingClosesAt, votingIsClosed } from "@/data/polls";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Meeting vote | Sac Retro Game Club",
  description: "Help pick when and where the Sac Retro Game Club meets.",
};

export default function MeetingVote() {
  if (votingIsClosed()) {
    return (
      <>
        <h1 className="font-pixel text-4xl leading-tight sm:text-5xl">Voting has closed</h1>
        <p className="mt-3 max-w-[60ch]">
          Thanks to everyone who ranked their picks. The club has settled on a monthly meetup.
        </p>
        <p className="mt-6 flex flex-wrap gap-4">
          <Link href="/results" className="pixel-btn bg-yellow text-xl">See the results</Link>
          <Link href="/" className="pixel-btn bg-field text-xl">Next meetup</Link>
        </p>
      </>
    );
  }

  const closes = votingClosesAt();
  return (
    <>
      <h1 className="font-pixel text-4xl leading-tight sm:text-5xl">Pick when and where we meet</h1>
      <p className="mb-10 mt-3 max-w-[60ch]">
        The club is settling on a monthly meetup: one day and time, one week of the month, one library.
        Rank what works for you in each list. Winners are chosen by ranked choice, so your 2nd and 3rd
        picks still count if your favorite gets knocked out.
        {closes && (
          <>
            {" "}Voting closes{" "}
            {closes.toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "full", timeStyle: "short" })}.
          </>
        )}
      </p>
      <Ballot />
    </>
  );
}
