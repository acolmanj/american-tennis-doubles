"use client";

import { useMemo } from "react";
import { computeStandings } from "./standings";
import { MatchRow, PlayerRow } from "./types";

export function useStandings(players: PlayerRow[], matches: MatchRow[]) {
  return useMemo(() => {
    const played = new Set(matches.flatMap((m) => [m.a1, m.a2, m.b1, m.b2]));
    const ids = players.filter((p) => p.status !== "withdrawn" || played.has(p.id)).map((p) => p.id);
    return computeStandings(ids, matches);
  }, [players, matches]);
}
