"use client";

import { useState } from "react";
import { rpc } from "@/lib/supabase";
import { MatchRow, PlayerRow } from "@/lib/types";
import { ErrorNote } from "./ui";

/** Big + / – buttons for each pair's games, then one tap to save. */
export function ScoreEntry({
  match,
  playerById,
  organizerKey,
  token,
  onDone,
}: {
  match: MatchRow;
  playerById: Map<string, PlayerRow>;
  organizerKey?: string | null;
  token?: string | null;
  onDone?: () => void;
}) {
  const [a, setA] = useState(match.score_a ?? 0);
  const [b, setB] = useState(match.score_b ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = (ids: string[]) => ids.map((id) => playerById.get(id)?.name ?? "?").join(" & ");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await rpc("enter_score", {
        p_match_id: match.id,
        p_score_a: a,
        p_score_b: b,
        p_key: organizerKey ?? null,
        p_token: organizerKey ? null : token ?? null,
      });
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const row = (label: string, value: number, set: (n: number) => void) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0 flex-1 text-lg font-semibold leading-tight">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost h-14 w-14 px-0 text-2xl" onClick={() => set(Math.max(0, value - 1))} aria-label={`One game fewer for ${label}`}>
          –
        </button>
        <span className="display w-12 text-center text-4xl tabular-nums">{value}</span>
        <button type="button" className="btn-primary h-14 w-14 px-0 text-2xl" onClick={() => set(Math.min(99, value + 1))} aria-label={`One game more for ${label}`}>
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className="card">
      <p className="display mb-2 text-xs text-muted">
        Round {match.round} · Court {match.court} · games won
      </p>
      {row(names([match.a1, match.a2]), a, setA)}
      <div className="my-1 border-t border-dashed border-line" />
      {row(names([match.b1, match.b2]), b, setB)}
      <button type="button" className="btn-primary mt-4 w-full" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save score"}
      </button>
      <ErrorNote message={error} />
    </div>
  );
}
