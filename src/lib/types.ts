export const LEVELS = ["proficient", "intermediate", "improver", "beginner"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  proficient: "Proficient",
  intermediate: "Intermediate",
  improver: "Improver",
  beginner: "Beginner",
};

export const LEVEL_VALUES: Record<Level, number> = {
  proficient: 4,
  intermediate: 3,
  improver: 2,
  beginner: 1,
};

export type Gender = "M" | "F";
export const GENDER_LABELS: Record<Gender, string> = { M: "Male", F: "Female" };

export type PlayerStatus = "registered" | "present" | "withdrawn";
export type RoundStatus = "upcoming" | "in_play" | "finished";
export type EventStatus = "setup" | "live" | "finished";

export interface EventRow {
  id: string;
  name: string;
  event_date: string | null;
  venue: string | null;
  courts: number;
  rounds: number;
  round_minutes: number;
  break_minutes: number;
  variety: number;
  mixed_rule: boolean;
  status: EventStatus;
  published: boolean;
  created_at: string;
}

export interface PlayerRow {
  id: string;
  event_id: string;
  name: string;
  gender: Gender;
  level: Level;
  status: PlayerStatus;
  group_id: string | null;
  created_at: string;
}

export interface RoundRow {
  event_id: string;
  round: number;
  status: RoundStatus;
}

export interface MatchRow {
  id: string;
  event_id: string;
  round: number;
  court: number;
  a1: string;
  a2: string;
  b1: string;
  b2: string;
  score_a: number | null;
  score_b: number | null;
}

export interface SitOutRow {
  event_id: string;
  round: number;
  player_id: string;
}
