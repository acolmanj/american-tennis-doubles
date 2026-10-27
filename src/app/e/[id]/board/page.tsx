"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Court } from "@/components/Court";
import { RoundControls } from "@/components/RoundControls";
import { ScoreEntry } from "@/components/ScoreEntry";
import { Header, Loading, Page, SectionTitle, TennisBall } from "@/components/ui";
import { useOrganizerKey } from "@/lib/storage";
import { currentRound, useEventData } from "@/lib/useEventData";

const STATUS_LABEL = { upcoming: "Up next", in_play: "In play", finished: "Finished" } as const;

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const { event, rounds, matches, sitOuts, playerById, loading } = useEventData(id);
  const organizerKey = useOrganizerKey();
  const [shown, setShown] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  if (loading) return <Loading />;
  if (!event) return <Page>This night couldn&apos;t be found.</Page>;

  const now = currentRound(rounds);
  const roundNo = shown ?? now?.round ?? 1;
  const round = rounds.find((r) => r.round === roundNo);
  const roundMatches = matches.filter((m) => m.round === roundNo);
  const sitting = sitOuts.filter((s) => s.round === roundNo);
  const courts = Array.from({ length: Math.max(0, ...matches.map((m) => m.court)) }, (_, i) => i + 1);

  return (
    <>
      <Header title={event.name} subtitle="All rounds" back={`/e/${id}`} wide />
      <Page wide>
        {!rounds.length ? (
          <p className="text-lg text-muted">The rounds haven&apos;t been drawn yet.</p>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {rounds.map((r) => (
                  <button key={r.round} className="chip" aria-pressed={r.round === roundNo} onClick={() => setShown(r.round)}>
                    {r.status === "in_play" && <TennisBall size={14} />}
                    <span className={r.status === "in_play" ? "ml-1" : ""}>R{r.round}</span>
                  </button>
                ))}
              </div>
              {organizerKey && <RoundControls eventId={id} organizerKey={organizerKey} rounds={rounds} />}
            </div>

            <h2 className="display mb-6 text-3xl md:text-5xl">
              Round {roundNo}
              <span className="ml-4 align-middle text-base text-muted md:text-xl">{round && STATUS_LABEL[round.status]}</span>
            </h2>

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {roundMatches.map((m) => (
                <div key={m.id}>
                  {organizerKey ? (
                    <button className="block w-full text-left" onClick={() => setEditing(editing === m.id ? null : m.id)} aria-label={`Enter score for court ${m.court}`}>
                      <Court match={m} playerById={playerById} large />
                    </button>
                  ) : (
                    <Court match={m} playerById={playerById} large />
                  )}
                  {editing === m.id && organizerKey && (
                    <div className="mt-3">
                      <ScoreEntry match={m} playerById={playerById} organizerKey={organizerKey} onDone={() => setEditing(null)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {sitting.length > 0 && (
              <p className="mt-6 text-lg">
                <span className="display mr-2 text-sm text-muted">Sitting out</span>
                {sitting.map((s) => playerById.get(s.player_id)?.name).join(", ")}
              </p>
            )}

            <SectionTitle>Whole night</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-muted">
                    <th className="p-2">Round</th>
                    {courts.map((c) => (
                      <th key={c} className="p-2">
                        Court {c}
                      </th>
                    ))}
                    <th className="p-2">Out</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((r) => (
                    <tr key={r.round} className={`border-t border-line align-top ${r.round === now?.round ? "bg-raised" : ""}`}>
                      <td className="display p-2 text-xl">{r.round}</td>
                      {courts.map((c) => {
                        const m = matches.find((x) => x.round === r.round && x.court === c);
                        if (!m) return <td key={c} className="p-2" />;
                        const n = (pid: string) => playerById.get(pid)?.name ?? "?";
                        return (
                          <td key={c} className="p-2 text-sm">
                            <div>
                              {n(m.a1)} & {n(m.a2)} <b className="tabular-nums">{m.score_a ?? ""}</b>
                            </div>
                            <div className="text-muted">
                              {n(m.b1)} & {n(m.b2)} <b className="tabular-nums text-white">{m.score_b ?? ""}</b>
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-2 text-sm text-muted">
                        {sitOuts
                          .filter((s) => s.round === r.round)
                          .map((s) => playerById.get(s.player_id)?.name)
                          .join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="mt-8 flex gap-3">
          <Link href={`/e/${id}/rankings`} className="btn-ghost btn-small">
            Rankings
          </Link>
          {organizerKey && (
            <Link href={`/e/${id}/manage`} className="btn-ghost btn-small">
              Manage
            </Link>
          )}
        </div>
      </Page>
    </>
  );
}
