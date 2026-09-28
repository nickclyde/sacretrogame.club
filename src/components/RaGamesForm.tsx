"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Host control for which RetroAchievements sets count toward a month. The API checks again. */
export function RaGamesForm({ month, label, stored, fixed }: { month: string; label: string; stored: number[]; fixed: number | null }) {
  const router = useRouter();
  const [games, setGames] = useState(stored.join(", "));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const id = `ra-games-${month}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/gotm/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ra-games", month, games }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setMessage({ text: data?.error ?? "That didn't work.", error: true });
    setMessage({ text: "Saved. Linked accounts get checked again on the next page load." });
    router.refresh();
  }

  return (
    <form onSubmit={save}>
      <label htmlFor={id} className="font-bold">{label}</label>
      {fixed && (
        <p className="text-sm text-muted">
          Set {fixed} always counts, from <code>src/data/games.ts</code>.
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-3">
        <input
          id={id}
          value={games}
          onChange={(e) => setGames(e.target.value)}
          placeholder="355, 7000"
          className="min-w-0 flex-1 basis-48 border-[3px] border-ink bg-field px-3 py-2"
        />
        <button type="submit" disabled={busy} className="pixel-btn bg-field">Save</button>
      </div>
      {message && <p role={message.error ? "alert" : "status"} className={`mt-2 text-sm ${message.error ? "text-red" : ""}`}>{message.text}</p>}
    </form>
  );
}
