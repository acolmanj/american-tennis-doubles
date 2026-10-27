"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Court } from "@/components/Court";
import { ScoreEntry } from "@/components/ScoreEntry";
import { Header, Loading, Page, SectionTitle, TennisBall } from "@/components/ui";
import { meKey, parseTokens, setMe, tokensKey, useStoredValue } from "@/lib/storage";
import { MatchRow, RoundRow } from "@/lib/types";
import { currentRound, useEventData } from "@/lib/useEventData";
import { useStandings } from "@/lib/useStandings";

const STATUS_LABEL: Record<RoundRow["status"], string> = {
  upcoming: "Up next",
  in_play: "In play",
  finished: "Finished",
};

export default function MyNightPage() {
  return (
    <Suspense fallback={<Loading />}>
      <MyNight />
    </Suspense>
  );
}

function MyNight() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const data = useEventData(id);
  const { event, players, rounds, matches, sitOuts, playerById, loading } = data;
  const standings = useStandings(players, matches);
  const storedMe = useStoredValue(meKey(id));
  const rawTokens = useStoredValue(tokensKey(id));
  const tokens = useMemo(() => parseTokens(rawTokens), [rawTokens]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  // A ?p= link (from the rankings) shows that player without changing who this phone belongs to.
  const meId = chosen ?? search.get("p") ?? storedMe;
  const setMeId = (pid: string) => {
    setMe(id, pid);
    setChosen(pid);
  };

  if (loading) return <Loading />;
  if (!event) return <Page>This night couldn&apos;t be found.</Page>;

  const me = meId ? playerById.get(meId) : undefined;
  if (!me) {
    return (
      <>
        <Header title="My night" subtitle={event.name} back={`/e/${id}`} />
        <Page>
          <p className="mb-4 text-lg">Who are you?</p>
          <Link href={`/e/${id}/checkin`} className="btn-primary mb-6 w-full">
            Check in
          </Link>
          <p className="label">Or just follow a player</p>
          <ul className="space-y-2">
            {players
              .filter((p) => p.status !== "withdrawn")
              .map((p) => (
                <li key={p.id}>
                  <button
                    className="card w-full text-left text-lg font-semibold"
                    onClick={() => setMeId(p.id)}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
          </ul>
        </Page>
      </>
    );
  }

  const token = tokens[me.id];
  const mine = (m: MatchRow) => [m.a1, m.a2, m.b1, m.b2].includes(me.id);
  const myMatches = matches.filter(mine);
  const now = currentRound(rounds);
  const nowMatch = now && myMatches.find((m) => m.round === now.round);
  const sittingNow = now && sitOuts.some((s) => s.round === now.round && s.player_id === me.id);
  const standing = standings.find((s) => s.playerId === me.id);
  const otherPhonePlayers = Object.keys(tokens).filter((pid) => pid !== me.id && playerById.has(pid));
  const partnerOf = (m: MatchRow) => ([m.a1, m.a2].includes(me.id) ? [m.a1, m.a2] : [m.b1, m.b2]).find((x) => x !== me.id)!;
  const roundStatus = (n: number) => rounds.find((r) => r.round === n)?.status ?? "upcoming";
  const canScore = (m: MatchRow) => !!token && roundStatus(m.round) !== "upcoming";

  return (
    <>
      <Header title={me.name} subtitle={event.name} back={`/e/${id}`} />
      <Page>
        {otherPhonePlayers.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {[me.id, ...otherPhonePlayers].map((pid) => (
              <button
                key={pid}
                className="chip"
                aria-pressed={pid === me.id}
                onClick={() => setMeId(pid)}
              >
                {playerById.get(pid)?.name}
              </button>
            ))}
          </div>
        )}

        <div className="card mb-6 grid grid-cols-3 text-center">
          <div>
            <p className="display text-3xl">{standing?.rank ?? "–"}</p>
            <p className="text-xs uppercase tracking-wider text-muted">Position</p>
          </div>
          <div>
            <p className="display text-3xl">{standing ? standing.gamesWon : 0}</p>
            <p className="text-xs uppercase tracking-wider text-muted">Games won</p>
          </div>
          <div>
            <p className="display text-3xl">{standing?.played ?? 0}</p>
            <p className="text-xs uppercase tracking-wider text-muted">Played</p>
          </div>
        </div>

        {!rounds.length ? (
          <p className="text-lg text-muted">The rounds haven&apos;t been drawn yet. They&apos;ll appear here as soon as they are.</p>
        ) : now ? (
          <section>
            <p className="display mb-3 flex items-center gap-2 text-sm">
              <TennisBall /> Round {now.round} · {STATUS_LABEL[now.status]}
            </p>
            {nowMatch ? (
              <>
                <p className="mb-4 text-2xl font-bold leading-snug">
                  Court {nowMatch.court} with {playerById.get(partnerOf(nowMatch))?.name}
                </p>
                <Court match={nowMatch} playerById={playerById} highlightId={me.id} large />
                {canScore(nowMatch) && editing !== nowMatch.id && (
                  <button className="btn-primary mt-4 w-full" onClick={() => setEditing(nowMatch.id)}>
                    {nowMatch.score_a == null ? "Enter score" : "Change score"}
                  </button>
                )}
              </>
            ) : sittingNow ? (
              <p className="card text-xl font-semibold">You&apos;re sitting this round out.</p>
            ) : (
              <p className="text-muted">You&apos;re not in this round.</p>
            )}
            {!token && (
              <p className="mt-3 text-sm text-muted">
                <Link href={`/e/${id}/checkin`} className="underline">
                  Check in
                </Link>{" "}
                on this phone to enter scores.
              </p>
            )}
          </section>
        ) : null}

        {editing && (
          <div className="mt-4">
            <ScoreEntry match={matches.find((m) => m.id === editing)!} playerById={playerById} token={token} onDone={() => setEditing(null)} />
          </div>
        )}

        {rounds.length > 0 && (
          <>
            <SectionTitle>All my rounds</SectionTitle>
            <ol className="space-y-3">
              {rounds.map((r) => {
                const m = myMatches.find((x) => x.round === r.round);
                const scored = m && m.score_a != null && m.score_b != null;
                const onA = m && [m.a1, m.a2].includes(me.id);
                return (
                  <li key={r.round} className={`card flex items-center gap-4 ${r.round === now?.round ? "border-white" : ""}`}>
                    <span className="display w-10 shrink-0 text-center text-2xl">{r.round}</span>
                    <div className="min-w-0 flex-1">
                      {m ? (
                        <>
                          <p className="font-semibold">
                            Court {m.court} · with {playerById.get(partnerOf(m))?.name}
                          </p>
                          <p className="truncate text-sm text-muted">
                            vs {(onA ? [m.b1, m.b2] : [m.a1, m.a2]).map((x) => playerById.get(x)?.name).join(" & ")}
                          </p>
                        </>
                      ) : (
                        <p className="text-muted">Sitting out</p>
                      )}
                    </div>
                    {m && scored ? (
                      <span className="display shrink-0 text-xl tabular-nums">
                        {onA ? m.score_a : m.score_b}–{onA ? m.score_b : m.score_a}
                      </span>
                    ) : m && canScore(m) ? (
                      <button className="btn-ghost btn-small shrink-0" onClick={() => setEditing(m.id)}>
                        Score
                      </button>
                    ) : (
                      <span className="shrink-0 text-xs uppercase tracking-wider text-muted">{STATUS_LABEL[r.status]}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}

        <div className="mt-8 grid grid-cols-2 gap-3">
          <Link href={`/e/${id}/board`} className="btn-ghost btn-small">
            All rounds
          </Link>
          <Link href={`/e/${id}/rankings`} className="btn-ghost btn-small">
            Rankings
          </Link>
        </div>
      </Page>
    </>
  );
}
