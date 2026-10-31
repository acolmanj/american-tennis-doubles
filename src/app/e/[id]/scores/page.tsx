"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ErrorNote, Header, Loading, Page } from "@/components/ui";
import { useOrganizerKey } from "@/lib/storage";
import { rpc } from "@/lib/supabase";
import { MatchRow, PlayerRow } from "@/lib/types";
import { useEventData } from "@/lib/useEventData";

const STATUS_LABEL = { upcoming: "Not started", in_play: "In play", finished: "Finished" } as const;

/** Every match of the night in one list, so the organizer can enter or fix any score. */
export default function ScoresPage() {
  const { id } = useParams<{ id: string }>();
  const organizerKey = useOrganizerKey();
  const { event, rounds, matches, playerById, loading } = useEventData(id);
  const [roundNo, setRoundNo] = useState<number | null>(null);

  if (loading) return <Loading />;
  if (!event) return <Page>This night couldn&apos;t be found.</Page>;
  if (!organizerKey) {
    return (
      <Page>
        <p className="mb-4">Sign in as the organizer first.</p>
        <Link href="/organizer" className="btn-primary">
          Organizer sign in
        </Link>
      </Page>
    );
  }

  const scored = matches.filter((m) => m.score_a != null && m.score_b != null).length;
  const shown = rounds.filter((r) => roundNo == null || r.round === roundNo);

  return (
    <>
      <Header title={event.name} subtitle="Scores" back={`/e/${id}/manage`} wide />
      <Page wide>
        {!rounds.length ? (
          <p className="text-lg text-muted">The rounds haven&apos;t been drawn yet.</p>
        ) : (
          <>
            <p className="mb-4 text-muted">
              {scored} of {matches.length} matches scored. Type the games each pair won and save. Leave both boxes empty to clear a score.
            </p>
            <div className="mb-6 flex flex-wrap gap-2">
              <button className="chip" aria-pressed={roundNo == null} onClick={() => setRoundNo(null)}>
                All
              </button>
              {rounds.map((r) => (
                <button key={r.round} className="chip" aria-pressed={roundNo === r.round} onClick={() => setRoundNo(r.round)}>
                  R{r.round}
                </button>
              ))}
            </div>
            <div className="space-y-8">
              {shown.map((r) => (
                <section key={r.round}>
                  <h2 className="display mb-3 text-xl">
                    Round {r.round}
                    <span className="ml-3 text-sm text-muted">{STATUS_LABEL[r.status]}</span>
                  </h2>
                  <ul className="divide-y divide-line rounded-2xl border border-line">
                    {matches
                      .filter((m) => m.round === r.round)
                      .map((m) => (
                        <ScoreRow key={`${m.id}-${m.score_a}-${m.score_b}`} match={m} playerById={playerById} organizerKey={organizerKey} />
                      ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
        <div className="mt-8 flex gap-3">
          <Link href={`/e/${id}/manage`} className="btn-ghost btn-small">
            Manage
          </Link>
          <Link href={`/e/${id}/rankings`} className="btn-ghost btn-small">
            Rankings
          </Link>
        </div>
      </Page>
    </>
  );
}

function ScoreRow({ match, playerById, organizerKey }: { match: MatchRow; playerById: Map<string, PlayerRow>; organizerKey: string }) {
  const [a, setA] = useState(match.score_a?.toString() ?? "");
  const [b, setB] = useState(match.score_b?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = (ids: string[]) => ids.map((pid) => playerById.get(pid)?.name ?? "?").join(" & ");
  const changed = a !== (match.score_a?.toString() ?? "") || b !== (match.score_b?.toString() ?? "");
  const valid = (a === "" && b === "") || (/^\d{1,2}$/.test(a) && /^\d{1,2}$/.test(b));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await rpc("enter_score", {
        p_match_id: match.id,
        p_score_a: a === "" ? null : Number(a),
        p_score_b: b === "" ? null : Number(b),
        p_key: organizerKey,
        p_token: null,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const box = (value: string, set: (v: string) => void, label: string) => (
    <input
      className="field w-16 px-2 text-center text-xl tabular-nums"
      inputMode="numeric"
      maxLength={2}
      value={value}
      onChange={(e) => set(e.target.value.replace(/\D/g, ""))}
      aria-label={label}
    />
  );

  return (
    <li className="px-3 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="display shrink-0 whitespace-nowrap text-sm text-muted">Court {match.court}</span>
        <span className="min-w-[10rem] flex-1 font-semibold">{names([match.a1, match.a2])}</span>
        <span className="flex items-center gap-2">
          {box(a, setA, `Games for ${names([match.a1, match.a2])}`)}
          <span className="text-muted">–</span>
          {box(b, setB, `Games for ${names([match.b1, match.b2])}`)}
        </span>
        <span className="min-w-[10rem] flex-1 font-semibold">{names([match.b1, match.b2])}</span>
        <button className="btn-primary btn-small w-24" disabled={!changed || !valid || saving} onClick={save}>
          {saving ? "Saving…" : !changed && match.score_a != null ? "Saved" : "Save"}
        </button>
      </div>
      <ErrorNote message={error} />
    </li>
  );
}
