import { PlannedRound } from "./pairing";

export interface RoundsSummary {
  rounds: number;
  /** Matches most players get. */
  usualMatches: number;
  /** Fewest sit-outs among players who were there all night. */
  fewestSitOuts: number;
  /** Players there all night who sit out more than the fewest, with their count, most first. */
  extraSitOuts: { playerId: string; sitOuts: number }[];
  /** Players who weren't in every round (arrived late or left early) and so play fewer matches than most. */
  fewerMatches: { playerId: string; matches: number }[];
}

function mostCommon(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  // Ties go to the higher value, which is the more generous reading of "most players".
  return [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
}

export function summarizeRounds(plan: PlannedRound[]): RoundsSummary {
  const matches = new Map<string, number>();
  const sitOuts = new Map<string, number>();
  for (const r of plan) {
    for (const m of r.matches) for (const id of [...m.teamA, ...m.teamB]) matches.set(id, (matches.get(id) ?? 0) + 1);
    for (const id of r.sitOuts) sitOuts.set(id, (sitOuts.get(id) ?? 0) + 1);
  }
  const ids = [...new Set([...matches.keys(), ...sitOuts.keys()])];
  const m = (id: string) => matches.get(id) ?? 0;
  const s = (id: string) => sitOuts.get(id) ?? 0;
  const usualMatches = mostCommon(ids.map(m));
  // Anyone missing from a round (neither playing nor sitting out) arrived late or left early.
  const allNight = ids.filter((id) => m(id) + s(id) === plan.length);
  const fewestSitOuts = Math.min(...allNight.map(s));
  const extraSitOuts = allNight
    .filter((id) => s(id) > fewestSitOuts)
    .map((id) => ({ playerId: id, sitOuts: s(id) }))
    .sort((a, b) => b.sitOuts - a.sitOuts);
  const fewerMatches = ids
    .filter((id) => m(id) + s(id) < plan.length && m(id) < usualMatches)
    .map((id) => ({ playerId: id, matches: m(id) }))
    .sort((a, b) => a.matches - b.matches);
  return { rounds: plan.length, usualMatches, fewestSitOuts: allNight.length ? fewestSitOuts : 0, extraSitOuts, fewerMatches };
}
