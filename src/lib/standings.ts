export interface ScoredMatch {
  round: number;
  a1: string;
  a2: string;
  b1: string;
  b2: string;
  score_a: number | null;
  score_b: number | null;
}

export interface Standing {
  playerId: string;
  rank: number;
  played: number;
  gamesWon: number;
  gamesLost: number;
  /** Games added for rounds missed, at the player's own average per round. */
  bonus: number;
  total: number;
  diff: number;
}

/**
 * Ranks players on games won. Anyone who has played fewer scored rounds than the most
 * anyone has played gets their average games per round added for each missing round,
 * so sitting out doesn't count against them.
 */
export function computeStandings(playerIds: string[], matches: ScoredMatch[]): Standing[] {
  const rows = new Map<string, Omit<Standing, "rank" | "total" | "bonus">>();
  for (const id of playerIds) rows.set(id, { playerId: id, played: 0, gamesWon: 0, gamesLost: 0, diff: 0 });

  for (const m of matches) {
    if (m.score_a == null || m.score_b == null) continue;
    const sides: [string[], number, number][] = [
      [[m.a1, m.a2], m.score_a, m.score_b],
      [[m.b1, m.b2], m.score_b, m.score_a],
    ];
    for (const [team, won, lost] of sides) {
      for (const id of team) {
        const r = rows.get(id);
        if (!r) continue;
        r.played++;
        r.gamesWon += won;
        r.gamesLost += lost;
        r.diff += won - lost;
      }
    }
  }

  const maxPlayed = Math.max(0, ...[...rows.values()].map((r) => r.played));
  const result: Standing[] = [...rows.values()].map((r) => {
    const missing = maxPlayed - r.played;
    const avgWon = r.played ? r.gamesWon / r.played : 0;
    const avgDiff = r.played ? r.diff / r.played : 0;
    const bonus = Math.round(avgWon * missing * 10) / 10;
    return {
      ...r,
      bonus,
      total: r.gamesWon + bonus,
      diff: Math.round((r.diff + avgDiff * missing) * 10) / 10,
      rank: 0,
    };
  });

  result.sort((a, b) => b.total - a.total || b.diff - a.diff);
  result.forEach((r, i) => {
    const prev = result[i - 1];
    r.rank = prev && prev.total === r.total && prev.diff === r.diff ? prev.rank : i + 1;
  });
  return result;
}
