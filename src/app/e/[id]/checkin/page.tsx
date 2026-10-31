"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { NameField, nameKey } from "@/components/NameField";
import { ErrorNote, Header, LevelBadge, Loading, NightClosed, Page } from "@/components/ui";
import { addTokens, setMe } from "@/lib/storage";
import { rpc } from "@/lib/supabase";
import { Gender, GENDER_LABELS, Level, LEVEL_LABELS, LEVELS } from "@/lib/types";
import { useEventData } from "@/lib/useEventData";

export default function CheckInPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { event, players, loading } = useEventData(id);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, Level>>({});
  const [walkIn, setWalkIn] = useState<{ name: string; gender: Gender | null; level: Level | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tonight = useMemo(() => new Set(players.map((p) => nameKey(p.name))), [players]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((p) => p.status !== "withdrawn" && (!q || p.name.toLowerCase().includes(q)));
  }, [players, query]);

  if (loading) return <Loading />;
  if (!event) return <Page>This night couldn&apos;t be found.</Page>;
  if (event.status === "finished") return <NightClosed eventId={id} title="Check in" subtitle={event.name} />;

  const ids = Object.keys(selected);

  async function finish(playerIds: string[], levels: Level[]) {
    const tokens = await rpc<Record<string, string>>("check_in", { p_player_ids: playerIds, p_levels: levels });
    addTokens(id, tokens);
    setMe(id, playerIds[0]);
    router.push(`/e/${id}/me`);
  }

  async function checkIn() {
    setSaving(true);
    setError(null);
    try {
      await finish(ids, ids.map((pid) => selected[pid]));
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  async function addWalkIn() {
    if (!walkIn?.name.trim() || !walkIn.gender || !walkIn.level) {
      setError("Add your name, Male/Female and level.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const [newId] = await rpc<string[]>("register_players", {
        p_event_id: id,
        p_players: [{ name: walkIn.name.trim(), gender: walkIn.gender, level: walkIn.level }],
      });
      await finish([newId], [walkIn.level]);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <>
      <Header title="Check in" subtitle={event.name} back={`/e/${id}`} />
      <Page>
        {walkIn ? (
          <div className="card space-y-4">
            <h2 className="display text-sm">Not on the list</h2>
            <NameField placeholder="Your name" value={walkIn.name} onChange={(name) => setWalkIn((w) => w && { ...w, name })} onRemembered={(gender, level) => setWalkIn((w) => w && { ...w, gender, level })} exclude={tonight} autoFocus />
            <div className="grid grid-cols-2 gap-2">
              {(["M", "F"] as Gender[]).map((g) => (
                <button key={g} type="button" className="chip" aria-pressed={walkIn.gender === g} onClick={() => setWalkIn({ ...walkIn, gender: g })}>
                  {GENDER_LABELS[g]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LEVELS.map((l) => (
                <button key={l} type="button" className="chip" aria-pressed={walkIn.level === l} onClick={() => setWalkIn({ ...walkIn, level: l })}>
                  {LEVEL_LABELS[l]}
                </button>
              ))}
            </div>
            <button className="btn-primary w-full" onClick={addWalkIn} disabled={saving}>
              Check in
            </button>
            <button className="w-full text-muted underline" onClick={() => setWalkIn(null)}>
              Back to the list
            </button>
            <ErrorNote message={error} />
          </div>
        ) : (
          <>
            <p className="mb-3 text-lg">Tap your name. Checking in friends too? Tap theirs as well.</p>
            <input className="field mb-4" placeholder="Search names" value={query} onChange={(e) => setQuery(e.target.value)} />
            <ul className="space-y-2">
              {list.map((p) => {
                const isSel = p.id in selected;
                return (
                  <li key={p.id} className={`card p-0 ${isSel ? "border-white" : ""}`}>
                    <button
                      type="button"
                      className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left"
                      aria-pressed={isSel}
                      onClick={() =>
                        setSelected((s) => {
                          const next = { ...s };
                          if (isSel) delete next[p.id];
                          else next[p.id] = p.level;
                          return next;
                        })
                      }
                    >
                      <span className="text-lg font-semibold">{p.name}</span>
                      <span className="flex items-center gap-3">
                        {p.status === "present" && <span className="text-sm text-muted">Here</span>}
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white ${isSel ? "bg-white text-black" : ""}`}>
                          {isSel ? "✓" : ""}
                        </span>
                      </span>
                    </button>
                    {isSel && (
                      <div className="border-t border-line px-4 pb-4 pt-3">
                        <p className="label">How would you rate yourself tonight?</p>
                        <div className="grid grid-cols-2 gap-2">
                          {LEVELS.map((l) => (
                            <button key={l} type="button" className="chip" aria-pressed={selected[p.id] === l} onClick={() => setSelected((s) => ({ ...s, [p.id]: l }))}>
                              <LevelBadge level={l} /> <span className="ml-1">{LEVEL_LABELS[l]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <button className="mt-4 w-full text-muted underline" onClick={() => setWalkIn({ name: query, gender: null, level: null })}>
              I&apos;m not on the list
            </button>
            <div className="sticky bottom-0 -mx-4 mt-6 bg-black px-4 py-4">
              <button className="btn-primary w-full" disabled={!ids.length || saving} onClick={checkIn}>
                {ids.length > 1 ? `Check in ${ids.length} players` : "Check in"}
              </button>
              <ErrorNote message={error} />
            </div>
          </>
        )}
      </Page>
    </>
  );
}
