"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PITCH_MAX } from "@/data/gotm";
import { coverUrl } from "@/lib/covers";
import type { Game } from "@/lib/igdb";

type Props = { remaining: number; searchEnabled: boolean };

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string };

const input = "w-full border-[3px] border-ink bg-field px-3 py-2";

export function NominateForm({ remaining, searchEnabled }: Props) {
  const router = useRouter();
  const [manual, setManual] = useState(!searchEnabled);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Game[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [platform, setPlatform] = useState("");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [url, setUrl] = useState("");
  const [pitch, setPitch] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    const q = query.trim();
    if (manual || game || q.length < 2) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/games/search?q=${encodeURIComponent(q)}`, { signal: controller.signal }).catch(() => null);
      if (controller.signal.aborted) return;
      const data = await res?.json().catch(() => null);
      setSearching(false);
      if (!res?.ok) {
        setSearchError(data?.error ?? "Search isn't working right now. Enter the game by hand.");
        return;
      }
      setSearchError(null);
      setResults(data.games);
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, manual, game]);

  function pick(g: Game) {
    setGame(g);
    setPlatform(g.platforms.length === 1 ? g.platforms[0] : "");
    setStatus({ kind: "idle" });
  }

  function reset() {
    setGame(null);
    setQuery("");
    setResults([]);
    setPlatform("");
    setTitle("");
    setYear("");
    setUrl("");
    setPitch("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "saving" });
    const body = game
      ? { igdbId: game.igdbId, platform, pitch }
      : { title, platform, year: year ? Number(year) : null, url, pitch };
    const res = await fetch("/api/gotm/nominations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setStatus({ kind: "error", message: data?.error ?? "Couldn't save your nomination. Check your connection and try again." });
      return;
    }
    reset();
    setStatus({ kind: "idle" });
    router.refresh();
  }

  const ready = platform.trim() !== "" && (game !== null || (manual && title.trim() !== ""));

  return (
    <form onSubmit={submit} className="pixel-box flex flex-col gap-5 p-5">
      <div>
        <h3 className="font-pixel text-2xl">Nominate a game</h3>
        <p className="text-sm text-muted">
          You have {remaining} nomination{remaining === 1 ? "" : "s"} left this month.
        </p>
      </div>

      {game ? (
        <div className="flex items-start gap-3">
          {game.coverImageId && (
            <Image src={coverUrl(game.coverImageId, "cover_small")} alt="" width={60} height={85} className="border-2 border-ink" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold">{game.title}</p>
            {game.year && <p className="text-sm text-muted">{game.year}</p>}
            <button type="button" onClick={reset} className="mt-1 text-sm underline">Pick a different game</button>
          </div>
        </div>
      ) : manual ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-bold">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold">Year <span className="font-normal text-muted">(optional)</span></span>
            <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={4} className={`${input} max-w-32`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold">Link to info about it <span className="font-normal text-muted">(optional)</span></span>
            <input
              inputMode="url"
              autoComplete="off"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              maxLength={500}
              placeholder="https://en.wikipedia.org/wiki/..."
              className={input}
            />
            <span className="text-xs text-muted">Wikipedia, MobyGames, the game&apos;s own site, or anywhere with details.</span>
          </label>
          {searchEnabled && (
            <button type="button" onClick={() => setManual(false)} className="self-start text-sm underline">Back to search</button>
          )}
        </div>
      ) : (
        <div>
          <label htmlFor="game-search" className="font-bold">Search for a game</label>
          <input
            id="game-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chrono Trigger"
            autoComplete="off"
            className={`${input} mt-1`}
          />
          {searchError && <p role="alert" className="mt-2 text-sm text-red">{searchError}</p>}
          {searching && results.length === 0 && <p className="mt-2 text-sm text-muted">Searching</p>}
          {results.length > 0 && query.trim().length >= 2 && (
            <ul className="mt-2 flex flex-col gap-1">
              {results.map((g) => (
                <li key={g.igdbId}>
                  <button
                    type="button"
                    onClick={() => pick(g)}
                    className="flex w-full items-center gap-3 border-[3px] border-ink/30 bg-field px-2 py-1 text-left hover:border-ink"
                  >
                    {g.coverImageId ? (
                      <Image src={coverUrl(g.coverImageId, "cover_small")} alt="" width={32} height={45} className="shrink-0" />
                    ) : (
                      <span className="h-[45px] w-8 shrink-0 bg-panel" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="font-bold">{g.title}</span>
                      {g.year && <span className="text-muted"> {g.year}</span>}
                      <span className="block truncate text-sm text-muted">{g.platforms.join(", ")}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm">
            <button type="button" onClick={() => setManual(true)} className="underline">Can&apos;t find it? Enter it by hand</button>
          </p>
          <p className="mt-1 text-xs text-muted">
            Game data from <a href="https://www.igdb.com" target="_blank" rel="noreferrer" className="underline">IGDB</a>.
          </p>
        </div>
      )}

      {(game || manual) && (
        <>
          {game && game.platforms.length > 0 ? (
            <label className="flex flex-col gap-1">
              <span className="font-bold">Which version should we play?</span>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} required className={`${input} max-w-xs`}>
                <option value="" disabled>Pick a platform</option>
                {game.platforms.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="font-bold">Platform</span>
              <input value={platform} onChange={(e) => setPlatform(e.target.value)} maxLength={40} required placeholder="SNES" className={`${input} max-w-xs`} />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="font-bold">Why this game? <span className="font-normal text-muted">(optional)</span></span>
            <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} maxLength={PITCH_MAX} rows={2} className={input} />
            <span className="text-right text-xs text-muted">{pitch.length}/{PITCH_MAX}</span>
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={!ready || status.kind === "saving"} className="pixel-btn bg-yellow text-xl">
              {status.kind === "saving" ? "Saving" : "Nominate"}
            </button>
            {status.kind === "error" && <p role="alert" className="text-red">{status.message}</p>}
          </div>
        </>
      )}
    </form>
  );
}
