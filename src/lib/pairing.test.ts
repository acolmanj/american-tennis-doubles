import { describe, expect, it } from "vitest";
import { generateSchedule, PairingPlayer, PlannedRound } from "./pairing";
import { Gender, Level, LEVELS } from "./types";

function makePlayers(men: number, women: number, levels: Level[] = [...LEVELS]): PairingPlayer[] {
  const out: PairingPlayer[] = [];
  const add = (g: Gender, i: number) =>
    out.push({ id: `${g}${i}`, gender: g, level: levels[(out.length * 7) % levels.length] });
  for (let i = 0; i < men; i++) add("M", i);
  for (let i = 0; i < women; i++) add("F", i);
  return out;
}

function partnerCounts(plan: PlannedRound[]) {
  const counts = new Map<string, number>();
  for (const r of plan)
    for (const m of r.matches)
      for (const [a, b] of [m.teamA, m.teamB]) {
        const k = [a, b].sort().join("|");
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
  return counts;
}

function genderOf(players: PairingPlayer[], id: string) {
  return players.find((p) => p.id === id)!.gender;
}

describe("generateSchedule", () => {
  it("fills 5 courts for 5 rounds with 20 players, everyone playing every round", () => {
    const players = makePlayers(10, 10);
    const plan = generateSchedule(players, { courts: 5, rounds: 5, variety: 50, mixed: true, seed: 1 });
    expect(plan).toHaveLength(5);
    for (const r of plan) {
      expect(r.matches).toHaveLength(5);
      expect(r.sitOuts).toHaveLength(0);
      const ids = r.matches.flatMap((m) => [...m.teamA, ...m.teamB]);
      expect(new Set(ids).size).toBe(20);
    }
  });

  it("never repeats a partner when there are enough players", () => {
    const players = makePlayers(10, 10);
    for (const variety of [0, 50, 100]) {
      const plan = generateSchedule(players, { courts: 5, rounds: 5, variety, mixed: true, seed: 7 });
      expect(Math.max(...partnerCounts(plan).values())).toBe(1);
    }
  });

  it("makes every pair one man and one woman when numbers are equal", () => {
    const players = makePlayers(10, 10);
    const plan = generateSchedule(players, { courts: 5, rounds: 5, variety: 50, mixed: true, seed: 3 });
    for (const r of plan)
      for (const m of r.matches)
        for (const team of [m.teamA, m.teamB])
          expect(genderOf(players, team[0])).not.toBe(genderOf(players, team[1]));
  });

  it("uses the fewest same-gender pairs possible and spreads them when numbers are uneven", () => {
    const players = makePlayers(12, 8);
    const plan = generateSchedule(players, { courts: 5, rounds: 5, variety: 50, mixed: true, seed: 5 });
    const sameGender = new Map<string, number>();
    for (const r of plan) {
      let pairsThisRound = 0;
      for (const m of r.matches)
        for (const team of [m.teamA, m.teamB])
          if (genderOf(players, team[0]) === genderOf(players, team[1])) {
            pairsThisRound++;
            for (const id of team) sameGender.set(id, (sameGender.get(id) ?? 0) + 1);
          }
      // 8 women make 8 mixed pairs; the other 4 men must form 2 men's pairs.
      expect(pairsThisRound).toBe(2);
    }
    // 2 pairs x 2 men x 5 rounds = 20 slots across 12 men: nobody should get more than 2.
    expect(Math.max(...sameGender.values())).toBeLessThanOrEqual(2);
  });

  it("shares sit-outs equally when there are more players than places", () => {
    const players = makePlayers(12, 12); // 24 players, 20 places, 4 sit out each round
    const plan = generateSchedule(players, { courts: 5, rounds: 5, variety: 50, mixed: true, seed: 11 });
    const sits = new Map<string, number>();
    for (const r of plan) {
      expect(r.sitOuts).toHaveLength(4);
      for (const id of r.sitOuts) sits.set(id, (sits.get(id) ?? 0) + 1);
    }
    // 20 sit-outs over 24 players: nobody sits out twice.
    expect(Math.max(...sits.values())).toBe(1);
    // Equal men and women sit out, so mixed pairs stay possible.
    for (const r of plan) {
      const men = r.sitOuts.filter((id) => genderOf(players, id) === "M").length;
      expect(men).toBe(2);
    }
  });

  it("uses fewer courts when there aren't enough players", () => {
    const players = makePlayers(5, 4);
    const plan = generateSchedule(players, { courts: 5, rounds: 3, variety: 50, mixed: true, seed: 2 });
    for (const r of plan) {
      expect(r.matches).toHaveLength(2);
      expect(r.sitOuts).toHaveLength(1);
    }
  });

  it("returns nothing for fewer than 4 players", () => {
    expect(generateSchedule(makePlayers(2, 1), { courts: 5, rounds: 5, variety: 50, mixed: true })).toEqual([]);
  });

  it("keeps games closer with the dial on balance than on variety", () => {
    const players = makePlayers(10, 10);
    const levels = new Map(players.map((p) => [p.id, ["beginner", "improver", "intermediate", "proficient"].indexOf(p.level) + 1]));
    const avgGap = (variety: number) => {
      let total = 0;
      let n = 0;
      for (let seed = 1; seed <= 5; seed++) {
        const plan = generateSchedule(players, { courts: 5, rounds: 5, variety, mixed: true, seed });
        for (const r of plan)
          for (const m of r.matches) {
            const a = levels.get(m.teamA[0])! + levels.get(m.teamA[1])!;
            const b = levels.get(m.teamB[0])! + levels.get(m.teamB[1])!;
            total += Math.abs(a - b);
            n++;
          }
      }
      return total / n;
    };
    expect(avgGap(0)).toBeLessThanOrEqual(avgGap(100));
  });

  it("plans only the remaining rounds and avoids partners already played", () => {
    const players = makePlayers(10, 10);
    const full = generateSchedule(players, { courts: 5, rounds: 5, variety: 50, mixed: true, seed: 9 });
    const played = full.slice(0, 2);
    const rest = generateSchedule(players, { courts: 5, rounds: 5, variety: 50, mixed: true, seed: 10 }, played);
    expect(rest.map((r) => r.round)).toEqual([3, 4, 5]);
    expect(Math.max(...partnerCounts([...played, ...rest]).values())).toBe(1);
  });

  it("handles a late arrival mid-evening", () => {
    const players = makePlayers(10, 10);
    const played = generateSchedule(players, { courts: 5, rounds: 5, variety: 50, mixed: true, seed: 4 }).slice(0, 2);
    const withLate = [...players, { id: "late", gender: "M" as const, level: "improver" as const }];
    const rest = generateSchedule(withLate, { courts: 5, rounds: 5, variety: 50, mixed: true, seed: 4 }, played);
    // 21 players, 20 places: the late arrival plays in at least one of the remaining rounds.
    const lateRounds = rest.filter((r) => !r.sitOuts.includes("late"));
    expect(lateRounds.length).toBeGreaterThan(0);
  });

  it("is fast enough for a big night", () => {
    const players = makePlayers(24, 24);
    const start = Date.now();
    generateSchedule(players, { courts: 12, rounds: 8, variety: 50, mixed: true, seed: 1 });
    expect(Date.now() - start).toBeLessThan(5000);
  });
});
