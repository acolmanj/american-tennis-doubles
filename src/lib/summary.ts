import { PlannedRound } from "./pairing";

export interface RoundsSummary {
  rounds: number;
  /** Matches most players get. */
  usualMatches: number;
  /** Players with more or fewer matches than most, fewest first. */
  different: { playerId: string; matches: number }[];
}

function mostCommon(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  // Ties go to the higher value, which is the more generous reading of "most players".
  return [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
}

export function summarizeRounds(plan: PlannedRound[]): RoundsSummary {
  const matches = new Map<string, number>();
  for (const r of plan) {
    for (const id of r.sitOuts) matches.set(id, matches.get(id) ?? 0);
    for (const m of r.matches) for (const id of [...m.teamA, ...m.teamB]) matches.set(id, (matches.get(id) ?? 0) + 1);
  }
  const usualMatches = mostCommon([...matches.values()]);
  const different = [...matches]
    .filter(([, n]) => n !== usualMatches)
    .map(([playerId, n]) => ({ playerId, matches: n }))
    .sort((a, b) => a.matches - b.matches);
  return { rounds: plan.length, usualMatches, different };
}
