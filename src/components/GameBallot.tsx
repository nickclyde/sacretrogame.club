"use client";

import Link from "next/link";
import { useState } from "react";
import type { Option } from "@/data/polls";
import { RankList } from "./RankList";

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

export function GameBallot({ options, initial, hasSaved }: { options: Option[]; initial: string[]; hasSaved: boolean }) {
  const [ranking, setRanking] = useState(initial);
  const [saved, setSaved] = useState(hasSaved);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "saving" });
    const res = await fetch("/api/gotm/ballot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ranking }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setStatus({ kind: "error", message: data?.error ?? "Couldn't save your ballot. Check your connection and try again." });
      return;
    }
    setSaved(true);
    setStatus({ kind: "saved" });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-8">
      <RankList options={options} value={ranking} onChange={(v) => { setRanking(v); setStatus({ kind: "idle" }); }} />
      <section className="pixel-box p-5">
        {status.kind === "saved" ? (
          <div>
            <p className="font-pixel text-2xl text-green">Ballot saved</p>
            <p className="mt-1">
              <Link href="/game-of-the-month" className="font-bold underline">Watch the results live</Link>, or keep
              adjusting and save again.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <button type="submit" disabled={status.kind === "saving" || ranking.length === 0} className="pixel-btn bg-yellow text-xl">
              {status.kind === "saving" ? "Saving" : saved ? "Save changes" : "Cast my ballot"}
            </button>
            {ranking.length === 0 && <p className="text-sm text-muted">Rank at least one game to vote.</p>}
            {status.kind === "error" && <p role="alert" className="basis-full text-red">{status.message}</p>}
          </div>
        )}
      </section>
    </form>
  );
}
