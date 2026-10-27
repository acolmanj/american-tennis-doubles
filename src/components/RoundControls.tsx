"use client";

import { useState } from "react";
import { rpc } from "@/lib/supabase";
import { RoundRow } from "@/lib/types";
import { ErrorNote } from "./ui";

/** Start / finish buttons for the organizer. There's no timer: the organizer calls time on court. */
export function RoundControls({ eventId, organizerKey, rounds }: { eventId: string; organizerKey: string; rounds: RoundRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inPlay = rounds.find((r) => r.status === "in_play");
  const next = rounds.find((r) => r.status === "upcoming");

  async function set(round: number, status: RoundRow["status"]) {
    setBusy(true);
    setError(null);
    try {
      await rpc("set_round_status", { p_key: organizerKey, p_event_id: eventId, p_round: round, p_status: status });
      if (status === "finished" && round === rounds[rounds.length - 1]?.round) {
        await rpc("save_event", { p_key: organizerKey, p_event: { id: eventId, status: "finished" } });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const last = [...rounds].reverse().find((r) => r.status === "finished");
  return (
    <div className="flex flex-wrap items-center gap-2">
      {inPlay ? (
        <button className="btn-primary" disabled={busy} onClick={() => set(inPlay.round, "finished")}>
          Finish round {inPlay.round}
        </button>
      ) : next ? (
        <button className="btn-primary" disabled={busy} onClick={() => set(next.round, "in_play")}>
          Start round {next.round}
        </button>
      ) : (
        rounds.length > 0 && <span className="display text-sm">All rounds finished</span>
      )}
      {!inPlay && last && (
        <button className="btn-ghost btn-small" disabled={busy} onClick={() => set(last.round, "in_play")}>
          Reopen round {last.round}
        </button>
      )}
      <ErrorNote message={error} />
    </div>
  );
}
