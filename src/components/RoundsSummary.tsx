import { PlannedRound } from "@/lib/pairing";
import { summarizeRounds } from "@/lib/summary";
import { PlayerRow } from "@/lib/types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "es"}`;

/**
 * How many matches most players get, then either who gets a different number or,
 * with bySitOuts, a table of everyone by how many rounds they sit out.
 */
export function RoundsSummary({
  plan,
  playerById,
  bySitOuts,
}: {
  plan: PlannedRound[];
  playerById: Map<string, PlayerRow>;
  bySitOuts?: boolean;
}) {
  if (!plan.length) return null;
  const s = summarizeRounds(plan);
  const name = (id: string) => playerById.get(id)?.name ?? "?";
  return (
    <div className="card space-y-2">
      <p className="text-lg font-semibold">
        Most players play {plural(s.usualMatches, "match")} over {s.rounds} rounds.
      </p>
      {bySitOuts ? (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted">
              <th className="w-20 py-1 pr-3">Sit-outs</th>
              <th className="py-1">Players</th>
            </tr>
          </thead>
          <tbody>
            {s.bySitOuts.map((g) => (
              <tr key={g.sitOuts} className="border-t border-line align-top">
                <td className="display py-2 pr-3 text-xl">{g.sitOuts}</td>
                <td className="py-2">
                  {g.playerIds
                    .map(name)
                    .sort((a, b) => a.localeCompare(b))
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        s.different.length > 0 && <p>{s.different.map((x) => `${name(x.playerId)} ${plural(x.matches, "match")}`).join(", ")}</p>
      )}
    </div>
  );
}
