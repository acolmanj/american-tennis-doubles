"use client";

import { useEffect, useMemo, useState } from "react";
import { rpc, supabase } from "@/lib/supabase";
import { GENDER_LABELS, MemberRow, PlayerRow } from "@/lib/types";
import { nameKey } from "./NameField";
import { ErrorNote, LevelBadge } from "./ui";

/** Pick club players to enter for a night. They go in as "Not yet" until they check in or are marked here. */
export function EntrantPicker({
  eventId,
  organizerKey,
  players,
  onClose,
}: {
  eventId: string;
  organizerKey: string;
  players: PlayerRow[];
  onClose: () => void;
}) {
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("members")
      .select("id, name, gender, level")
      .order("name")
      .then(({ data }) => setMembers((data as MemberRow[]) ?? []));
  }, []);

  const entered = useMemo(
    () => new Set(players.filter((p) => p.status !== "withdrawn").map((p) => nameKey(p.name))),
    [players],
  );
  const q = nameKey(search);
  const available = (members ?? []).filter((m) => !entered.has(nameKey(m.name)));
  const shown = available.filter((m) => !q || nameKey(m.name).includes(q));

  function toggle(id: string) {
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const chosen = available.filter((m) => picked.has(m.id)).map(({ name, gender, level }) => ({ name, gender, level }));
      await rpc("organizer_add_players", { p_key: organizerKey, p_event_id: eventId, p_players: chosen });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="card mb-4 space-y-3 border-white">
      <div className="flex items-center justify-between gap-3">
        <h3 className="display text-sm">Enter club players</h3>
        <button type="button" className="text-sm text-muted underline" onClick={onClose}>
          Close
        </button>
      </div>
      <input className="field" type="search" placeholder="Search club players" value={search} onChange={(e) => setSearch(e.target.value)} />
      {members === null ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              {available.length} not entered yet{picked.size ? ` · ${picked.size} picked` : ""}
            </span>
            {shown.length > 0 && (
              <button
                type="button"
                className="underline"
                onClick={() => setPicked((s) => new Set([...s, ...shown.map((m) => m.id)]))}
              >
                Pick all{q ? " shown" : ""}
              </button>
            )}
          </div>
          <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {shown.map((m) => (
              <li key={m.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                  <input type="checkbox" className="h-5 w-5 shrink-0 accent-white" checked={picked.has(m.id)} onChange={() => toggle(m.id)} />
                  <span className="min-w-0 flex-1 font-semibold">{m.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-sm text-muted">
                    {GENDER_LABELS[m.gender][0]}
                    <LevelBadge level={m.level} />
                  </span>
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 py-3 text-muted">No one else to add.</li>}
          </ul>
        </>
      )}
      <button type="button" className="btn-primary w-full" disabled={busy || picked.size === 0} onClick={add}>
        {picked.size ? `Enter ${picked.size} as Not yet` : "Pick players to enter"}
      </button>
      <ErrorNote message={error} />
    </div>
  );
}
