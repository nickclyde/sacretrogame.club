"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RemoveNomination({ id, title, admin }: { id: string; title: string; admin?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!confirm(admin ? `Remove ${title} from the ballot?` : `Withdraw your nomination of ${title}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/gotm/nominations/${id}`, { method: "DELETE" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "Couldn't remove it. Try again.");
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={remove} disabled={busy} className="text-sm underline disabled:opacity-50">
        {admin ? "Remove (admin)" : "Withdraw"}
      </button>
      {error && <span role="alert" className="text-sm text-red">{error}</span>}
    </>
  );
}
