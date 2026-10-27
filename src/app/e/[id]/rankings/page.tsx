"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Crest, Header, LevelBadge, Loading, Page } from "@/components/ui";
import { Gender, Level, LEVEL_LABELS, LEVELS } from "@/lib/types";
import { useEventData } from "@/lib/useEventData";
import { useStandings } from "@/lib/useStandings";

export default function RankingsPage() {
  const { id } = useParams<{ id: string }>();
  const { event, players, matches, playerById, loading } = useEventData(id);
  const standings = useStandings(players, matches);
  const [level, setLevel] = useState<Level | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);

  if (loading) return <Loading />;
  if (!event) return <Page>This night couldn&apos;t be found.</Page>;

  const rows = standings.filter((s) => {
    const p = playerById.get(s.playerId);
    return p && (!level || p.level === level) && (!gender || p.gender === gender);
  });
  const finished = event.status === "finished";

  return (
    <>
      <Header title={finished ? "Final rankings" : "Rankings"} subtitle={event.name} back={`/e/${id}`} />
      <Page wide>
        {finished && (
          <div className="mb-6 flex justify-center">
            <Crest size={120} />
          </div>
        )}
        <div className="mb-4 flex flex-wrap gap-2">
          <button className="chip" aria-pressed={!level && !gender} onClick={() => (setLevel(null), setGender(null))}>
            Everyone
          </button>
          {(["M", "F"] as Gender[]).map((g) => (
            <button key={g} className="chip" aria-pressed={gender === g} onClick={() => setGender(gender === g ? null : g)}>
              {g === "M" ? "Men" : "Women"}
            </button>
          ))}
          {LEVELS.map((l) => (
            <button key={l} className="chip" aria-pressed={level === l} onClick={() => setLevel(level === l ? null : l)}>
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted">
                <th className="p-2 text-center">#</th>
                <th className="p-2">Player</th>
                <th className="p-2 text-right">Games</th>
                <th className="p-2 text-right">+/–</th>
                <th className="p-2 text-right">Played</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const p = playerById.get(s.playerId)!;
                return (
                  <tr key={s.playerId} className={`border-t border-line ${s.rank <= 3 ? "text-xl" : "text-lg"}`}>
                    <td className="display p-2 text-center">{s.rank}</td>
                    <td className="p-2">
                      <Link href={`/e/${id}/me?p=${p.id}`} className="flex items-center gap-2 font-semibold">
                        <LevelBadge level={p.level} /> {p.name}
                      </Link>
                    </td>
                    <td className="display p-2 text-right tabular-nums">
                      {s.total}
                      {s.bonus > 0 && <span className="block text-xs font-normal normal-case tracking-normal text-muted">incl. {s.bonus} avg</span>}
                    </td>
                    <td className="p-2 text-right tabular-nums">{s.diff > 0 ? `+${s.diff}` : s.diff}</td>
                    <td className="p-2 text-right tabular-nums text-muted">{s.played}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-sm text-muted">
          Ranked on games won, then game difference. A player who sat out more rounds gets their average games added for each missing round.
        </p>
      </Page>
    </>
  );
}
