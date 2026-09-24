"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = {
  /** Refresh once at this moment, such as when voting opens. */
  at?: string;
  /** Refresh on this interval in ms while the tab is visible. */
  every?: number;
};

/** Re-renders the server page so live results and phase changes show up without a reload. */
export function AutoRefresh({ at, every }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!at) return;
    const ms = new Date(at).getTime() - Date.now();
    // Timers longer than about 24 days overflow, and nobody keeps a tab open that long.
    if (ms < 0 || ms > 2 ** 31 - 1) return;
    const t = setTimeout(() => router.refresh(), ms + 500);
    return () => clearTimeout(t);
  }, [at, router]);

  useEffect(() => {
    if (!every) return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const t = setInterval(tick, every);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [every, router]);

  return null;
}
