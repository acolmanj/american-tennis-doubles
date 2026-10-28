import { describe, expect, it } from "vitest";
import { generateSchedule, PairingPlayer, PlannedRound } from "./pairing";
import { summarizeRounds } from "./summary";

const players = (n: number): PairingPlayer[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, gender: i % 2 ? "F" : "M", level: "intermediate" }));

describe("summarizeRounds", () => {
  it("names no one when everyone plays the same number of matches", () => {
    const plan = generateSchedule(players(25), { courts: 5, rounds: 5, variety: 50, mixed: true, seed: 1 });
    expect(summarizeRounds(plan)).toEqual({ rounds: 5, usualMatches: 4, different: [] });
  });

  it("names only players whose match count differs from most", () => {
    // 18 players, 4 courts, 5 rounds: 10 sit-outs among 18, so 10 play 4 and 8 play 5.
    const plan = generateSchedule(players(18), { courts: 4, rounds: 5, variety: 50, mixed: true, seed: 2 });
    const s = summarizeRounds(plan);
    expect(s.usualMatches).toBe(4);
    expect(s.different).toHaveLength(8);
    expect(s.different.every((x) => x.matches === 5)).toBe(true);
  });

  it("includes late arrivals and players who never played", () => {
    const round = (n: number, ids: string[], out: string[] = []): PlannedRound => ({
      round: n,
      matches: [{ court: 1, teamA: [ids[0], ids[1]], teamB: [ids[2], ids[3]] }],
      sitOuts: out,
    });
    const plan = [round(1, ["a", "b", "c", "d"], ["f"]), round(2, ["a", "b", "c", "d"], ["f"]), round(3, ["a", "b", "c", "e"], ["d", "f"])];
    const s = summarizeRounds(plan);
    expect(s.usualMatches).toBe(3);
    expect(s.different).toEqual([
      { playerId: "f", matches: 0 },
      { playerId: "e", matches: 1 },
      { playerId: "d", matches: 2 },
    ]);
  });
});
