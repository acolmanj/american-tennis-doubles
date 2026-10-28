import { PlannedRound } from "@/lib/pairing";
import { summarizeRounds } from "@/lib/summary";
import { PlayerRow } from "@/lib/types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "es"}`;

/** How many matches most players get, and who gets a different number. */
export function RoundsSummary({ plan, playerById }: { plan: PlannedRound[]; playerById: Map<string, PlayerRow> }) {
  if (!plan.length) return null;
  const s = summarizeRounds(plan);
  return (
    <div className="card space-y-2">
      <p className="text-lg font-semibold">
        Most players play {plural(s.usualMatches, "match")} over {s.rounds} rounds.
      </p>
      {s.different.length > 0 && (
        <p>
          {s.different.map((x) => `${playerById.get(x.playerId)?.name ?? "?"} ${plural(x.matches, "match")}`).join(", ")}
        </p>
      )}
    </div>
  );
}
