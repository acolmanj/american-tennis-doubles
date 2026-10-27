import { describe, expect, it } from "vitest";
import { computeStandings } from "./standings";

const m = (round: number, a1: string, a2: string, b1: string, b2: string, sa: number | null, sb: number | null) => ({
  round,
  a1,
  a2,
  b1,
  b2,
  score_a: sa,
  score_b: sb,
});

describe("computeStandings", () => {
  it("adds up games won per player and ranks by total", () => {
    const s = computeStandings(["a", "b", "c", "d"], [m(1, "a", "b", "c", "d", 6, 3), m(2, "a", "c", "b", "d", 4, 5)]);
    const byId = Object.fromEntries(s.map((r) => [r.playerId, r]));
    expect(byId.a.gamesWon).toBe(10);
    expect(byId.b.gamesWon).toBe(11);
    expect(byId.c.gamesWon).toBe(7);
    expect(byId.d.gamesWon).toBe(8);
    expect(s.map((r) => r.playerId)).toEqual(["b", "a", "d", "c"]);
  });

  it("ignores matches without a score", () => {
    const s = computeStandings(["a", "b", "c", "d"], [m(1, "a", "b", "c", "d", null, null)]);
    expect(s.every((r) => r.played === 0 && r.total === 0)).toBe(true);
  });

  it("gives a player who sat out their average for the missing round", () => {
    const s = computeStandings(
      ["a", "b", "c", "d", "e"],
      [m(1, "a", "b", "c", "d", 6, 2), m(2, "e", "b", "c", "d", 3, 5)],
    );
    const a = s.find((r) => r.playerId === "a")!;
    expect(a.played).toBe(1);
    expect(a.bonus).toBe(6);
    expect(a.total).toBe(12);
  });

  it("uses game difference to break ties and shares rank when still level", () => {
    const s = computeStandings(["a", "b", "c", "d"], [m(1, "a", "b", "c", "d", 4, 4)]);
    expect(s.every((r) => r.rank === 1)).toBe(true);
  });
});
