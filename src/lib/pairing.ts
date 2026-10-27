import { Gender, Level, LEVEL_VALUES } from "./types";

export interface PairingPlayer {
  id: string;
  gender: Gender;
  level: Level;
}

export interface PlannedMatch {
  court: number;
  teamA: [string, string];
  teamB: [string, string];
}

export interface PlannedRound {
  round: number;
  matches: PlannedMatch[];
  sitOuts: string[];
}

export interface PairingOptions {
  courts: number;
  rounds: number;
  /** 0 = favour close, level-matched games; 100 = favour meeting as many people as possible. */
  variety: number;
  /** Each pair should be one man and one woman, relaxed when the numbers don't allow it. */
  mixed: boolean;
  seed?: number;
  restarts?: number;
}

export interface Weights {
  partner: number;
  opponent: number;
  balance: number;
  spread: number;
  mixed: number;
}

export function weightsFor(variety: number): Weights {
  const v = Math.min(100, Math.max(0, variety)) / 100;
  return {
    partner: 60 + 240 * v,
    opponent: 2 + 18 * v,
    balance: 2 + 18 * (1 - v),
    spread: 1 + 9 * (1 - v),
    mixed: 1000,
  };
}

/** Small seeded PRNG so a schedule can be reproduced in tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Counter {
  private counts = new Map<string, number>();
  private key(a: string, b: string) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }
  get(a: string, b: string) {
    return this.counts.get(this.key(a, b)) ?? 0;
  }
  add(a: string, b: string) {
    const k = this.key(a, b);
    this.counts.set(k, (this.counts.get(k) ?? 0) + 1);
  }
}

export class History {
  partners = new Counter();
  opponents = new Counter();
  sitOuts = new Map<string, number>();
  sameGenderPairs = new Map<string, number>();

  record(round: PlannedRound, genders: Map<string, Gender>) {
    for (const m of round.matches) {
      this.partners.add(m.teamA[0], m.teamA[1]);
      this.partners.add(m.teamB[0], m.teamB[1]);
      for (const a of m.teamA) for (const b of m.teamB) this.opponents.add(a, b);
      for (const team of [m.teamA, m.teamB]) {
        if (genders.get(team[0]) === genders.get(team[1])) {
          for (const p of team) this.sameGenderPairs.set(p, (this.sameGenderPairs.get(p) ?? 0) + 1);
        }
      }
    }
    for (const id of round.sitOuts) this.sitOuts.set(id, (this.sitOuts.get(id) ?? 0) + 1);
  }
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Picks who sits out: fewest sit-outs so far first. Among equals, the gender with more
 * players than the other sits out first, so the remaining group can form more mixed pairs.
 */
export function chooseSitOuts(
  players: PairingPlayer[],
  count: number,
  history: History,
  mixed: boolean,
  rand: () => number,
): string[] {
  if (count <= 0) return [];
  let menLeft = players.filter((p) => p.gender === "M").length;
  let womenLeft = players.length - menLeft;
  const chosen: string[] = [];
  const pool = shuffle(players, rand).sort(
    (a, b) => (history.sitOuts.get(a.id) ?? 0) - (history.sitOuts.get(b.id) ?? 0),
  );
  while (chosen.length < count) {
    const minCount = history.sitOuts.get(pool[0].id) ?? 0;
    const tied = pool.filter((p) => (history.sitOuts.get(p.id) ?? 0) === minCount);
    let pick = tied[0];
    if (mixed) {
      const over: Gender | null = menLeft > womenLeft ? "M" : womenLeft > menLeft ? "F" : null;
      pick = tied.find((p) => p.gender === over) ?? tied[0];
    }
    chosen.push(pick.id);
    if (pick.gender === "M") menLeft--;
    else womenLeft--;
    pool.splice(pool.indexOf(pick), 1);
  }
  return chosen;
}

export function costOfArrangement(
  slots: PairingPlayer[],
  history: History,
  w: Weights,
  mixed: boolean,
): number {
  let cost = 0;
  for (let c = 0; c < slots.length; c += 4) {
    const [a1, a2, b1, b2] = [slots[c], slots[c + 1], slots[c + 2], slots[c + 3]];
    cost += courtCost(a1, a2, b1, b2, history, w, mixed);
  }
  return cost;
}

function teamCost(x: PairingPlayer, y: PairingPlayer, history: History, w: Weights, mixed: boolean) {
  const repeats = history.partners.get(x.id, y.id);
  let cost = w.partner * repeats * repeats + w.partner * repeats;
  if (mixed && x.gender === y.gender) {
    // Spread forced same-gender pairs across different players.
    cost +=
      w.mixed *
      (1 + (history.sameGenderPairs.get(x.id) ?? 0) + (history.sameGenderPairs.get(y.id) ?? 0));
  }
  return cost;
}

function courtCost(
  a1: PairingPlayer,
  a2: PairingPlayer,
  b1: PairingPlayer,
  b2: PairingPlayer,
  history: History,
  w: Weights,
  mixed: boolean,
) {
  let cost = teamCost(a1, a2, history, w, mixed) + teamCost(b1, b2, history, w, mixed);
  for (const a of [a1, a2]) {
    for (const b of [b1, b2]) {
      const n = history.opponents.get(a.id, b.id);
      cost += w.opponent * n * n;
    }
  }
  const lv = [a1, a2, b1, b2].map((p) => LEVEL_VALUES[p.level]);
  cost += w.balance * Math.abs(lv[0] + lv[1] - lv[2] - lv[3]);
  cost += w.spread * (Math.max(...lv) - Math.min(...lv));
  return cost;
}

/** Finds a low-cost arrangement of the active players into courts by hill-climbing from random starts. */
export function arrangeRound(
  active: PairingPlayer[],
  history: History,
  w: Weights,
  mixed: boolean,
  rand: () => number,
  restarts = 40,
): PairingPlayer[] {
  const n = active.length;
  let best: PairingPlayer[] = active;
  let bestCost = Infinity;
  const courtOf = (s: PairingPlayer[], c: number) =>
    courtCost(s[c * 4], s[c * 4 + 1], s[c * 4 + 2], s[c * 4 + 3], history, w, mixed);
  for (let r = 0; r < restarts; r++) {
    const slots = shuffle(active, rand);
    const courts = Array.from({ length: n / 4 }, (_, c) => courtOf(slots, c));
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const ci = Math.floor(i / 4);
          const cj = Math.floor(j / 4);
          if (ci === cj && (i % 4 < 2) === (j % 4 < 2)) continue;
          const before = courts[ci] + (ci === cj ? 0 : courts[cj]);
          [slots[i], slots[j]] = [slots[j], slots[i]];
          const ni = courtOf(slots, ci);
          const nj = ci === cj ? 0 : courtOf(slots, cj);
          if (ni + nj < before - 1e-9) {
            courts[ci] = ni;
            if (ci !== cj) courts[cj] = nj;
            improved = true;
          } else {
            [slots[i], slots[j]] = [slots[j], slots[i]];
          }
        }
      }
    }
    const cost = courts.reduce((a, b) => a + b, 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = [...slots];
    }
  }
  return best;
}

/**
 * Plans the rounds still to be played. Rounds already played (with any late arrivals or
 * withdrawals) are passed in `played` so their partners, opponents and sit-outs count.
 */
export function generateSchedule(
  players: PairingPlayer[],
  options: PairingOptions,
  played: PlannedRound[] = [],
): PlannedRound[] {
  const rand = mulberry32(options.seed ?? Date.now());
  const w = weightsFor(options.variety);
  const genders = new Map<string, Gender>();
  for (const p of players) genders.set(p.id, p.gender);

  const history = new History();
  for (const r of played) history.record(r, genders);

  const courts = Math.min(options.courts, Math.floor(players.length / 4));
  const plan: PlannedRound[] = [];
  if (courts < 1) return plan;
  const firstRound = played.reduce((max, r) => Math.max(max, r.round), 0) + 1;

  for (let round = firstRound; round <= options.rounds; round++) {
    const sitOuts = chooseSitOuts(players, players.length - courts * 4, history, options.mixed, rand);
    const sitting = new Set(sitOuts);
    const active = players.filter((p) => !sitting.has(p.id));
    const slots = arrangeRound(active, history, w, options.mixed, rand, options.restarts);
    const matches: PlannedMatch[] = [];
    for (let c = 0; c < courts; c++) {
      const s = slots.slice(c * 4, c * 4 + 4);
      matches.push({ court: c + 1, teamA: [s[0].id, s[1].id], teamB: [s[2].id, s[3].id] });
    }
    const planned = { round, matches, sitOuts };
    history.record(planned, genders);
    plan.push(planned);
  }
  return plan;
}
