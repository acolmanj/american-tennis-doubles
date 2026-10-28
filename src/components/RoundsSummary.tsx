import { PlannedRound } from "@/lib/pairing";
import { summarizeRounds } from "@/lib/summary";
import { PlayerRow } from "@/lib/types";

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "es"}`;

/** How many matches most players get, and who sits out more than the rest. */
export function RoundsSummary({ plan, playerById }: { plan: PlannedRound[]; playerById: Map<string, PlayerRow> }) {
  if (!plan.length) return null;
  const s = summarizeRounds(plan);
  const name = (id: string) => playerById.get(id)?.name ?? "?";
  return (
    <div className="card space-y-2">
      <p className="text-lg font-semibold">
        Most players play {plural(s.usualMatches, "match")} over {s.rounds} rounds.
      </p>
      {s.extraSitOuts.length ? (
        <p>
          <span className="text-muted">
            Sitting out more than others{s.fewestSitOuts ? ` (most sit out ${times(s.fewestSitOuts)})` : ""}:
          </span>{" "}
          {s.extraSitOuts.map((x) => `${name(x.playerId)} ${times(x.sitOuts)}`).join(", ")}
        </p>
      ) : (
        <p className="text-muted">
          {s.fewestSitOuts ? `Everyone sits out ${times(s.fewestSitOuts)}, so no one sits out more than others.` : "No one sits out."}
        </p>
      )}
      {s.fewerMatches.length > 0 && (
        <p>
          <span className="text-muted">Not here for every round:</span>{" "}
          {s.fewerMatches.map((x) => `${name(x.playerId)} ${plural(x.matches, "match")}`).join(", ")}
        </p>
      )}
    </div>
  );
}
