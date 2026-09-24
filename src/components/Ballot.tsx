"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LIBRARIES } from "@/data/libraries";
import { SLOTS, WEEKS, type Option } from "@/data/polls";
import type { DriveMinutes } from "@/lib/ballot";
import { RankList } from "./RankList";

const LibraryMap = dynamic(() => import("./LibraryMap"), {
  ssr: false,
  loading: () => <div className="pixel-box grid h-[420px] place-items-center text-muted">Loading map</div>,
});

const LIBRARY_OPTIONS: Option[] = LIBRARIES.map((l) => ({ id: l.id, label: l.name, detail: l.street }));
const NAME_KEY = "srgc-name";

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

export function Ballot() {
  const [name, setName] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [libraries, setLibraries] = useState<string[]>([]);
  const [existing, setExisting] = useState<string | null>(null);
  const [loadedNotice, setLoadedNotice] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const [address, setAddress] = useState("");
  const [home, setHome] = useState<{ lat: number; lng: number; formatted: string } | null>(null);
  const [minutes, setMinutes] = useState<DriveMinutes | null>(null);
  const [share, setShare] = useState(false);
  const [lookup, setLookup] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const [sortBy, setSortBy] = useState<"weeknight" | "weekend" | null>(null);

  const loadedFor = useRef<string | null>(null);

  async function loadBallot(forName: string) {
    const trimmed = forName.trim();
    if (!trimmed || loadedFor.current === trimmed.toLowerCase()) return;
    loadedFor.current = trimmed.toLowerCase();
    const res = await fetch(`/api/ballot?name=${encodeURIComponent(trimmed)}`).catch(() => null);
    const data = res?.ok ? await res.json() : null;
    if (data?.ballot) {
      setSlots(data.ballot.slots);
      setWeeks(data.ballot.weeks);
      setLibraries(data.ballot.libraries);
      setExisting(data.ballot.name);
      setLoadedNotice(true);
    } else {
      setExisting(null);
      setLoadedNotice(false);
    }
  }

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(NAME_KEY);
    } catch {}
    if (saved) {
      // localStorage only exists on the client, so this has to happen after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(saved);
      loadBallot(saved);
    }
  }, []);

  async function findDriveTimes(e: React.FormEvent) {
    e.preventDefault();
    setLookup({ busy: true });
    const res = await fetch("/api/drive-times", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok || !data?.minutes) {
      setLookup({ busy: false, error: data?.error ?? "Drive time lookup failed. Check your connection and try again." });
      return;
    }
    setHome(data.origin);
    setMinutes(data.minutes);
    setSortBy("weeknight");
    setLookup({ busy: false });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "saving" });
    const res = await fetch("/api/ballot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slots, weeks, libraries, driveMinutes: share ? minutes : null }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setStatus({ kind: "error", message: data?.error ?? "Couldn't save your ballot. Check your connection and try again." });
      return;
    }
    try {
      localStorage.setItem(NAME_KEY, name.trim());
    } catch {}
    setExisting(name.trim());
    setStatus({ kind: "saved" });
  }

  const libraryOptions =
    sortBy && minutes
      ? [...LIBRARY_OPTIONS].sort((a, b) => (minutes[a.id]?.[sortBy] ?? 999) - (minutes[b.id]?.[sortBy] ?? 999))
      : LIBRARY_OPTIONS;

  const driveMeta = minutes
    ? (id: string) =>
        minutes[id] ? (
          <span className="shrink-0 text-right text-sm leading-tight text-muted">
            <span className={sortBy === "weeknight" ? "font-bold text-ink" : ""}>{minutes[id]!.weeknight} min</span>
            <span aria-hidden> / </span>
            <span className="sr-only"> weeknight, </span>
            <span className={sortBy === "weekend" ? "font-bold text-ink" : ""}>{minutes[id]!.weekend} min</span>
            <span className="sr-only"> Saturday</span>
          </span>
        ) : null
    : undefined;

  const dirty = () => status.kind !== "idle" && setStatus({ kind: "idle" });
  const total = slots.length + weeks.length + libraries.length;

  return (
    <form onSubmit={save} className="flex flex-col gap-12">
      <section>
        <label htmlFor="name" className="font-pixel text-2xl">
          Enter your name<span aria-hidden className="blink">_</span>
        </label>
        <p className="mb-3 text-muted">Your name or Discord username. Use the same one later to change your votes.</p>
        <input
          id="name"
          required
          maxLength={40}
          autoComplete="nickname"
          value={name}
          onChange={(e) => { setName(e.target.value); dirty(); }}
          onBlur={() => loadBallot(name)}
          className="w-full max-w-sm border-[3px] border-ink bg-field px-3 py-2 font-pixel text-xl"
        />
        {existing && loadedNotice && (
          <p className="mt-2 text-sm text-green">Loaded the ballot saved for {existing}. Saving again replaces it.</p>
        )}
      </section>

      <section>
        <h2 className="font-pixel text-2xl">Day and time</h2>
        <p className="mb-4 text-muted">
          Rank the slots you could make, best first. No Sunday or Monday options: library meeting rooms
          can&apos;t be booked those days. Rooms stay available for evening meetings after the branch closes.
        </p>
        <RankList options={SLOTS} value={slots} onChange={(v) => { setSlots(v); dirty(); }} />
      </section>

      <section>
        <h2 className="font-pixel text-2xl">Week of the month</h2>
        <p className="mb-4 text-muted">
          We&apos;ll meet monthly on the same week, like &ldquo;the 3rd Wednesday.&rdquo; Rank the weeks that suit you.
        </p>
        <RankList options={WEEKS} value={weeks} onChange={(v) => { setWeeks(v); dirty(); }} />
      </section>

      <section>
        <h2 className="font-pixel text-2xl">Library</h2>
        <p className="mb-4 text-muted">
          Nine branches have rooms we can use. Pins show your ranking as you build it.
        </p>
        <LibraryMap
          ranking={libraries}
          home={home}
          minutes={minutes}
          onRank={(id) => { setLibraries((cur) => (cur.includes(id) ? cur : [...cur, id])); dirty(); }}
        />

        <div className="mt-6">
          <label htmlFor="address" className="font-bold">How long is the drive from your place?</label>
          <p className="mb-2 text-sm text-muted">
            Enter an address, cross streets, or a ZIP code. It&apos;s used once to estimate drive times with
            typical traffic and is never saved.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") findDriveTimes(e); }}
              autoComplete="street-address"
              placeholder="1234 J St, Sacramento"
              className="min-w-0 flex-1 basis-64 border-[3px] border-ink bg-field px-3 py-2"
            />
            <button type="button" onClick={findDriveTimes} disabled={lookup.busy || address.trim().length < 5} className="pixel-btn bg-field">
              {lookup.busy ? "Checking traffic" : "Get drive times"}
            </button>
          </div>
          {lookup.error && <p role="alert" className="mt-2 text-red">{lookup.error}</p>}
          {minutes && home && (
            <div className="mt-3 text-sm">
              <p>
                From {home.formatted}. Times show as <strong>weeknight</strong> (leaving 5:30 PM) /{" "}
                <strong>Saturday</strong> (midday).
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3">
                Sort unranked libraries by
                {(["weeknight", "weekend"] as const).map((k) => (
                  <button key={k} type="button" aria-pressed={sortBy === k} onClick={() => setSortBy(k)} className={`cursor-pointer underline-offset-4 ${sortBy === k ? "font-bold" : "underline"}`}>
                    {k === "weeknight" ? "weeknight drive" : "Saturday drive"}
                  </button>
                ))}
              </p>
              <label className="mt-2 flex items-start gap-2">
                <input type="checkbox" checked={share} onChange={(e) => { setShare(e.target.checked); dirty(); }} className="mt-1 h-4 w-4 accent-purple" />
                <span>Include my drive times (minutes only, no address) in the group averages on the results page.</span>
              </label>
            </div>
          )}
        </div>

        <div className="mt-6">
          <RankList options={libraryOptions} value={libraries} onChange={(v) => { setLibraries(v); dirty(); }} meta={driveMeta} />
        </div>
      </section>

      <section className="pixel-box p-5">
        {status.kind === "saved" ? (
          <div>
            <p className="font-pixel text-2xl text-green">Ballot saved</p>
            <p className="mt-1">
              <Link href="/results" className="font-bold underline">See the results so far</Link>, or keep
              adjusting and save again.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <button type="submit" disabled={status.kind === "saving" || total === 0} className="pixel-btn bg-yellow text-xl">
              {status.kind === "saving" ? "Saving" : existing ? "Save changes" : "Save my ballot"}
            </button>
            <p className="text-sm text-muted">
              {total === 0 ? "Rank at least one option to save." : "Anything you left unranked counts as a no."}
            </p>
            {status.kind === "error" && <p role="alert" className="basis-full text-red">{status.message}</p>}
          </div>
        )}
      </section>
    </form>
  );
}
