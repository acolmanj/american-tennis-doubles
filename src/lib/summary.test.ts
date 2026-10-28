import { describe, expect, it } from "vitest";
import { generateSchedule, PairingPlayer, PlannedRound } from "./pairing";
import { summarizeRounds } from "./summary";

const players = (n: number): PairingPlayer[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, gender: i % 2 ? "F" : "M", level: "intermediate" }));

describe("summarizeRounds", () => {
  it("reports an even night with no one singled out", () => {
    const plan = generateSchedule(players(25), { courts: 5, rounds: 5, variety: 50, mixed: true, seed: 1 });
    const s = summarizeRounds(plan);
    expect(s).toMatchObject({ rounds: 5, usualMatches: 4, fewestSitOuts: 1, extraSitOuts: [], fewerMatches: [] });
  });

  it("names players who sit out more than most", () => {
    // 18 players, 4 courts, 5 rounds: 10 sit-outs among 18, so 8 never sit out and 10 sit out once.
    const plan = generateSchedule(players(18), { courts: 4, rounds: 5, variety: 50, mixed: true, seed: 2 });
    const s = summarizeRounds(plan);
    expect(s.usualMatches).toBe(4);
    expect(s.fewestSitOuts).toBe(0);
    expect(s.extraSitOuts).toHaveLength(10);
    expect(s.extraSitOuts.every((x) => x.sitOuts === 1)).toBe(true);
  });

  it("lists a late arrival separately from extra sit-outs", () => {
    const four = ["a", "b", "c", "d"] as const;
    const round = (n: number, ids: string[], out: string[] = []): PlannedRound => ({
      round: n,
      matches: [{ court: 1, teamA: [ids[0], ids[1]], teamB: [ids[2], ids[3]] }],
      sitOuts: out,
    });
    const plan = [round(1, [...four]), round(2, [...four]), round(3, ["a", "b", "c", "e"], ["d"])];
    const s = summarizeRounds(plan);
    expect(s.usualMatches).toBe(3);
    expect(s.extraSitOuts).toEqual([{ playerId: "d", sitOuts: 1 }]);
    expect(s.fewerMatches).toEqual([{ playerId: "e", matches: 1 }]);
  });
});
