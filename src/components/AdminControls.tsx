"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Phase } from "@/lib/gotm";

type Props = { phase: Phase; opensAt: string; closesAt: string };

const CONFIRM = {
  "open-now": "Open voting now? Nominations close and the club gets a Discord post.",
  "close-now": "Close voting now and reveal the winner?",
  reset: "Go back to the regular schedule? A recorded winner is cleared and counted again when voting closes.",
} as const;

/** Only rendered for admins. The API checks again. */
export function AdminControls({ phase, opensAt, closesAt }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: keyof typeof CONFIRM) {
    if (!confirm(CONFIRM[action])) return;
    setBusy(true);
    const res = await fetch("/api/gotm/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "That didn't work.");
    setError(null);
    router.refresh();
  }

  return (
    <section className="border-[3px] border-dashed border-ink p-4">
      <h2 className="font-pixel text-xl">Host controls</h2>
      <p className="text-sm text-muted">
        Voting opens {opensAt} and closes {closesAt}.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {phase === "nominating" && (
          <button type="button" disabled={busy} onClick={() => act("open-now")} className="pixel-btn bg-field">Open voting now</button>
        )}
        {phase === "voting" && (
          <button type="button" disabled={busy} onClick={() => act("close-now")} className="pixel-btn bg-field">Close voting now</button>
        )}
        <button type="button" disabled={busy} onClick={() => act("reset")} className="pixel-btn bg-field">Back to schedule</button>
      </div>
      {error && <p role="alert" className="mt-2 text-red">{error}</p>}
    </section>
  );
}
