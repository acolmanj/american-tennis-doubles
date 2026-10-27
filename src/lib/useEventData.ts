"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { EventRow, MatchRow, PlayerRow, RoundRow, SitOutRow } from "./types";

export interface EventData {
  event: EventRow | null;
  players: PlayerRow[];
  rounds: RoundRow[];
  matches: MatchRow[];
  sitOuts: SitOutRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  playerById: Map<string, PlayerRow>;
}

const PLAYER_COLUMNS = "id, event_id, name, gender, level, status, group_id, created_at";

/** Loads everything about one event and keeps it live as anyone changes it. */
export function useEventData(eventId: string): EventData {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [sitOuts, setSitOuts] = useState<SitOutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    const [e, p, r, m, s] = await Promise.all([
      supabase.from("events").select("*").eq("id", eventId).maybeSingle(),
      supabase.from("players").select(PLAYER_COLUMNS).eq("event_id", eventId).order("name"),
      supabase.from("rounds").select("*").eq("event_id", eventId).order("round"),
      supabase.from("matches").select("*").eq("event_id", eventId).order("round").order("court"),
      supabase.from("sit_outs").select("*").eq("event_id", eventId),
    ]);
    const firstError = [e, p, r, m, s].find((x) => x.error)?.error;
    if (firstError) setError(firstError.message);
    else setError(null);
    setEvent((e.data as EventRow) ?? null);
    setPlayers((p.data as PlayerRow[]) ?? []);
    setRounds((r.data as RoundRow[]) ?? []);
    setMatches((m.data as MatchRow[]) ?? []);
    setSitOuts((s.data as SitOutRow[]) ?? []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    const scheduleReload = (delay = 250) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(reload, delay);
    };
    scheduleReload(0);
    const filter = `event_id=eq.${eventId}`;
    const channel = supabase
      .channel(`event-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `id=eq.${eventId}` }, () => scheduleReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter }, () => scheduleReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "rounds", filter }, () => scheduleReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter }, () => scheduleReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "sit_outs", filter }, () => scheduleReload())
      .subscribe();
    // Phones sleep between rounds; catch up when the screen comes back.
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [eventId, reload]);

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  return { event, players, rounds, matches, sitOuts, loading, error, reload, playerById };
}

/** The round in play, or else the next one to be played, or else the last one. */
export function currentRound(rounds: RoundRow[]): RoundRow | undefined {
  return (
    rounds.find((r) => r.status === "in_play") ??
    rounds.find((r) => r.status === "upcoming") ??
    rounds[rounds.length - 1]
  );
}
