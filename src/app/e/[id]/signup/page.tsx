"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { NameField, nameKey } from "@/components/NameField";
import { ErrorNote, Header, Loading, Page } from "@/components/ui";
import { rpc } from "@/lib/supabase";
import { Gender, GENDER_LABELS, Level, LEVEL_LABELS, LEVELS } from "@/lib/types";
import { useEventData } from "@/lib/useEventData";

interface Draft {
  name: string;
  gender: Gender | null;
  level: Level | null;
}

const blank = (): Draft => ({ name: "", gender: null, level: null });

export default function SignupPage() {
  const { id } = useParams<{ id: string }>();
  const { event, players, loading } = useEventData(id);
  const tonight = useMemo(() => new Set(players.map((p) => nameKey(p.name))), [players]);
  const [drafts, setDrafts] = useState<Draft[]>([blank()]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  if (loading) return <Loading />;
  if (!event) return <Page>This night couldn&apos;t be found.</Page>;

  const update = (i: number, patch: Partial<Draft>) => setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const incomplete = drafts.findIndex((d) => !d.name.trim() || !d.gender || !d.level);
    if (incomplete >= 0) {
      setError(`Player ${incomplete + 1} needs a name, Male/Female and a level.`);
      return;
    }
    setSaving(true);
    try {
      await rpc("register_players", { p_event_id: id, p_players: drafts });
      setDone(drafts.map((d) => d.name.trim()));
      setDrafts([blank()]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <>
        <Header title="You're in" subtitle={event.name} back={`/e/${id}`} />
        <Page>
          <p className="text-xl">Signed up:</p>
          <ul className="mt-2 space-y-1 text-2xl font-bold">
            {done.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className="mt-6 text-muted">On the night, scan the QR code at the club to check in.</p>
          <div className="mt-8 grid gap-3">
            <button className="btn-ghost" onClick={() => setDone(null)}>
              Sign up more players
            </button>
            <Link href={`/e/${id}`} className="btn-primary">
              Done
            </Link>
          </div>
        </Page>
      </>
    );
  }

  return (
    <>
      <Header title="Sign up" subtitle={event.name} back={`/e/${id}`} />
      <Page>
        <form onSubmit={submit} className="space-y-5">
          {drafts.map((d, i) => (
            <fieldset key={i} className="card space-y-4">
              <div className="flex items-center justify-between">
                <legend className="display text-sm">Player {i + 1}</legend>
                {drafts.length > 1 && (
                  <button type="button" className="text-sm text-muted underline" onClick={() => setDrafts((x) => x.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                )}
              </div>
              <label className="block">
                <span className="label">Name</span>
                <NameField value={d.name} onChange={(name) => update(i, { name })} onRemembered={(gender, level) => update(i, { gender, level })} exclude={tonight} />
              </label>
              <div>
                <span className="label">Male / Female</span>
                <div className="grid grid-cols-2 gap-2">
                  {(["M", "F"] as Gender[]).map((g) => (
                    <button key={g} type="button" className="chip" aria-pressed={d.gender === g} onClick={() => update(i, { gender: g })}>
                      {GENDER_LABELS[g]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="label">Level</span>
                <div className="grid grid-cols-2 gap-2">
                  {LEVELS.map((l) => (
                    <button key={l} type="button" className="chip" aria-pressed={d.level === l} onClick={() => update(i, { level: l })}>
                      {LEVEL_LABELS[l]}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>
          ))}
          <button type="button" className="btn-ghost w-full border-dashed" onClick={() => setDrafts((d) => [...d, blank()])} disabled={drafts.length >= 12}>
            + Add another player
          </button>
          <button className="btn-primary w-full" disabled={saving}>
            {saving ? "Signing up…" : drafts.length > 1 ? `Sign up ${drafts.length} players` : "Sign up"}
          </button>
          <ErrorNote message={error} />
        </form>
      </Page>
    </>
  );
}
