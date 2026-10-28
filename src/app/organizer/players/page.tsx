"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { nameKey } from "@/components/NameField";
import { ErrorNote, Header, LevelBadge, Loading, Page } from "@/components/ui";
import { useOrganizerKey } from "@/lib/storage";
import { rpc, supabase } from "@/lib/supabase";
import { Gender, GENDER_LABELS, Level, LEVEL_LABELS, LEVELS, MemberRow } from "@/lib/types";

export default function ClubPlayersPage() {
  const key = useOrganizerKey();
  return (
    <>
      <Header title="Club players" subtitle="Names, Male/Female and levels" back="/organizer" />
      <Page>
        {key ? (
          <PlayerList organizerKey={key} />
        ) : (
          <p className="text-muted">
            <Link href="/organizer" className="underline">Sign in as organizer</Link> to edit club players.
          </p>
        )}
      </Page>
    </>
  );
}

function PlayerList({ organizerKey }: { organizerKey: string }) {
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("members").select("id, name, gender, level").order("name");
    setMembers((data as MemberRow[]) ?? []);
  }, []);

  useEffect(() => {
    // Loaded after mount so the list reflects edits made on another device.
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const shown = useMemo(() => {
    const q = nameKey(search);
    return (members ?? []).filter((m) => !q || nameKey(m.name).includes(q));
  }, [members, search]);

  if (!members) return <Loading />;

  async function saved(message: string) {
    setEditing(null);
    setNote(message);
    await load();
  }

  return (
    <>
      <input
        className="field"
        type="search"
        placeholder={`Search ${members.length} players`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <p className="mt-2 text-sm text-muted">
        Changes here fill in at the next signup. Fixing a name or Male/Female also updates the nights they played. If two
        entries are the same person, rename one to match the other and they become one.
      </p>
      {note && <p className="mt-3 font-semibold" role="status">{note}</p>}
      <ul className="mt-4 space-y-2">
        {shown.map((m) =>
          editing === m.id ? (
            <EditRow
              key={m.id}
              member={m}
              organizerKey={organizerKey}
              others={members}
              onCancel={() => setEditing(null)}
              onSaved={saved}
            />
          ) : (
            <li key={m.id}>
              <button
                type="button"
                className="card flex w-full items-center justify-between gap-3 text-left hover:border-white"
                onClick={() => {
                  setNote(null);
                  setEditing(m.id);
                }}
              >
                <span className="truncate font-semibold">{m.name}</span>
                <span className="flex shrink-0 items-center gap-3 text-sm text-muted">
                  {GENDER_LABELS[m.gender]}
                  <LevelBadge level={m.level} showLabel />
                </span>
              </button>
            </li>
          ),
        )}
      </ul>
      {shown.length === 0 && <p className="mt-4 text-muted">No one matches “{search}”.</p>}
    </>
  );
}

function EditRow({
  member,
  organizerKey,
  others,
  onCancel,
  onSaved,
}: {
  member: MemberRow;
  organizerKey: string;
  others: MemberRow[];
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(member.name);
  const [gender, setGender] = useState<Gender>(member.gender);
  const [level, setLevel] = useState<Level>(member.level);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // The database matches names ignoring case and spacing, so a rename onto an existing name merges the two.
  const dbKey = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const twin = others.find((o) => o.id !== member.id && dbKey(o.name) === dbKey(name));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await rpc("organizer_save_member", { p_key: organizerKey, p_id: member.id, p_name: name, p_gender: gender, p_level: level });
      onSaved(twin ? `Merged into ${name.trim()}.` : `Saved ${name.trim()}.`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await rpc("organizer_delete_member", { p_key: organizerKey, p_id: member.id });
      onSaved(`Removed ${member.name}. Their past nights are kept.`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <li className="card space-y-4 border-white">
      <label className="block">
        <span className="label">Name</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      {twin && (
        <p className="text-sm">
          {twin.name} is already on the list. Saving will merge the two into one player, using the Male/Female and level
          below.
        </p>
      )}
      <div>
        <span className="label">Male / Female</span>
        <div className="flex gap-2">
          {(["M", "F"] as Gender[]).map((g) => (
            <button key={g} type="button" className="chip flex-1" aria-pressed={gender === g} onClick={() => setGender(g)}>
              {GENDER_LABELS[g]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Level</span>
        <div className="grid grid-cols-2 gap-2">
          {LEVELS.map((l) => (
            <button key={l} type="button" className="chip flex items-center justify-center gap-2" aria-pressed={level === l} onClick={() => setLevel(l)}>
              <LevelBadge level={l} />
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-primary flex-1" disabled={busy || !name.trim()} onClick={save}>
          {twin ? "Merge" : "Save"}
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
      {confirmRemove ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span>Remove {member.name} from the list? Past nights are kept.</span>
          <button type="button" className="btn-small shrink-0" disabled={busy} onClick={remove}>
            Remove
          </button>
        </div>
      ) : (
        <button type="button" className="text-sm text-muted underline" onClick={() => setConfirmRemove(true)}>
          Remove from list
        </button>
      )}
      <ErrorNote message={error} />
    </li>
  );
}
