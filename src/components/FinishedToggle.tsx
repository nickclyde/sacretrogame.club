"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** The honor system "I finished it" box for one month's game. */
export function FinishedToggle({ month, done, title }: { month: string; done: boolean; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    const res = await fetch("/api/gotm/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, done: !done }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "That didn't work. Try again.");
    setError(null);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`I finished ${title}`}
        disabled={busy}
        onClick={toggle}
        className={`pixel-btn flex items-center gap-3 text-lg ${done ? "bg-yellow" : "bg-field"}`}
      >
        <span aria-hidden className="grid size-6 place-items-center border-[3px] border-current leading-none">
          {done ? "✓" : ""}
        </span>
        I finished it
      </button>
      {error && <p role="alert" className="mt-2 text-red">{error}</p>}
    </div>
  );
}
