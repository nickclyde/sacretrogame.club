import Image from "next/image";
import Link from "next/link";
import { VenueMap } from "@/components/VenueMap";
import { GAME_PICKS } from "@/data/games";
import { directionsUrl, fullAddress } from "@/data/libraries";
import { MEETING, MEETING_LIBRARY } from "@/data/meeting";
import { TZ, nextMeeting } from "@/lib/meeting";

// The next meeting date depends on the current time.
export const dynamic = "force-dynamic";

const ORDINALS = ["1st", "2nd", "3rd", "4th"];
const DISCORD_INVITE_URL = "https://discord.gg/SpMgfr3dbh";

export default function Home() {
  const { start, end } = nextMeeting(MEETING);
  const date = start.toLocaleDateString("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });
  const weekday = start.toLocaleDateString("en-US", { timeZone: TZ, weekday: "long" });
  const hour = (d: Date) => d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric" });
  const game = GAME_PICKS[start.toLocaleDateString("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" })];

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-x-8 gap-y-4 sm:flex-row-reverse sm:items-center sm:justify-between">
        <Image
          src="/logo.gif"
          alt="Sac Retro Game Club logo"
          width={192}
          height={192}
          unoptimized
          preload
          className="shrink-0 [image-rendering:pixelated]"
        />
        <div>
          <h1 className="font-pixel text-4xl leading-tight sm:text-5xl">
            Come play with us<span aria-hidden className="blink">_</span>
          </h1>
          <p className="mt-3 max-w-[60ch]">
            Sac Retro Game Club is a community for retro gaming fans in Sacramento and beyond: original
            hardware, emulation, FPGA, arcades, buy/sell/trade, and monthly game picks. We hang out on
            Discord and get together in person once a month.
          </p>
          <p className="mt-6">
            <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer" className="pixel-btn inline-block bg-yellow text-xl">
              Join the Discord
            </a>
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-pixel text-2xl">Next meetup</h2>
        <div className="pixel-box mb-6 p-5">
          <p className="font-pixel text-3xl leading-tight">{date}</p>
          <p className="font-pixel text-2xl text-purple">{hour(start)} to {hour(end)}</p>
          <p className="mt-3 font-bold">{MEETING_LIBRARY.name}</p>
          <p>{fullAddress(MEETING_LIBRARY)}</p>
          <p className="mt-3">
            <a className="font-bold underline" href={directionsUrl(MEETING_LIBRARY)} target="_blank" rel="noreferrer">
              Get directions
            </a>
          </p>
        </div>
        <VenueMap library={MEETING_LIBRARY} />
        <p className="mt-6 text-sm">
          We meet on the {ORDINALS[MEETING.week - 1]} {weekday} of every month. Members picked the schedule by
          ranked choice vote. <Link href="/results" className="underline">See how the vote went</Link>.
        </p>
      </section>

      {game && (
        <section>
          <h2 className="mb-3 font-pixel text-2xl">Game of the month</h2>
          <div className="pixel-box p-5">
            {game.image && (
              <Image {...game.image} alt="" className="logo-plate mb-4 h-auto w-full max-w-[320px]" />
            )}
            <p className="font-pixel text-3xl leading-tight">{game.title}</p>
            <p className="font-pixel text-2xl text-purple">{game.platform}</p>
            <p className="mt-3 max-w-[60ch]">
              This is the game we&apos;ll be talking about at the next meetup. Any way of playing is
              encouraged:{" "}
              {game.mod ? (
                <>
                  original hardware, emulation, or even something like{" "}
                  <a className="underline" href={game.mod.url} target="_blank" rel="noreferrer">{game.mod.label}</a>.
                </>
              ) : (
                "original hardware or emulation."
              )}
            </p>
            <p className="mt-3 max-w-[60ch]">
              Play however makes it the most fun. Don&apos;t be afraid of guides or save states!
            </p>
            {game.achievementsUrl && (
              <p className="mt-3 max-w-[60ch]">
                For bonus points, link your emulator to{" "}
                <a className="underline" href={game.achievementsUrl} target="_blank" rel="noreferrer">RetroAchievements</a>{" "}
                to show off your completion!
              </p>
            )}
            {game.aboutUrl && (
              <p className="mt-3">
                <a className="font-bold underline" href={game.aboutUrl} target="_blank" rel="noreferrer">
                  Read about the game on Wikipedia
                </a>
              </p>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-1 font-pixel text-2xl">More coming soon</h2>
        <p className="max-w-[60ch] text-muted">
          This site is just getting started. More about the club is on the way. Until then,{" "}
          <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer" className="underline">the Discord</a> is
          where everything happens.
        </p>
      </section>
    </div>
  );
}
