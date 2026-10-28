"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ErrorNote, Header, Page, SectionTitle } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { setOrganizerKey, useOrganizerKey } from "@/lib/storage";
import { rpc, supabase } from "@/lib/supabase";
import { EventRow } from "@/lib/types";

export default function OrganizerPage() {
  const key = useOrganizerKey();
  return (
    <>
      <Header title="Organizer" back="/" />
      <Page>{key ? <Dashboard organizerKey={key} /> : <Login />}</Page>
    </>
  );
}

function Login() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const ok = await rpc<boolean>("verify_organizer", { p_key: code });
      if (ok) setOrganizerKey(code);
      else setError("That passcode isn't right.");
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="label">Organizer passcode</span>
        <input className="field" type="password" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
      </label>
      <button className="btn-primary w-full">Sign in</button>
      <ErrorNote message={error} />
    </form>
  );
}

function Dashboard({ organizerKey }: { organizerKey: string }) {
  const router = useRouter();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [name, setName] = useState("American Doubles Night");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const [codeMsg, setCodeMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: false })
      .then(({ data }) => setEvents((data as EventRow[]) ?? []));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const id = await rpc<string>("save_event", {
        p_key: organizerKey,
        p_event: { name, event_date: date, venue: "Charleville LTC" },
      });
      router.push(`/e/${id}/manage`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function changeCode(e: FormEvent) {
    e.preventDefault();
    setCodeMsg(null);
    try {
      await rpc("change_organizer_passcode", { p_key: organizerKey, p_new: newCode });
      setOrganizerKey(newCode);
      setNewCode("");
      setCodeMsg("Passcode changed.");
    } catch (err) {
      setCodeMsg((err as Error).message);
    }
  }

  return (
    <>
      <form onSubmit={create} className="card space-y-4">
        <h2 className="display text-sm">New night</h2>
        <label className="block">
          <span className="label">Name</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block">
          <span className="label">Date</span>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="btn-primary w-full">Create</button>
        <ErrorNote message={error} />
      </form>

      <Link href="/organizer/players" className="card mt-4 flex justify-between gap-3 hover:border-white">
        <span className="font-semibold">Club players</span>
        <span className="text-muted">Fix names, Male/Female, levels</span>
      </Link>

      <SectionTitle>All nights</SectionTitle>
      <ul className="space-y-2">
        {events.map((ev) => (
          <li key={ev.id}>
            <Link href={`/e/${ev.id}/manage`} className="card flex justify-between gap-3 hover:border-white">
              <span className="truncate font-semibold">{ev.name}</span>
              <span className="shrink-0 text-muted">
                {formatDate(ev.event_date)} · {ev.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <SectionTitle>Passcode</SectionTitle>
      <form onSubmit={changeCode} className="flex gap-2">
        <input className="field" type="password" placeholder="New passcode (6+ characters)" value={newCode} onChange={(e) => setNewCode(e.target.value)} minLength={6} required />
        <button className="btn-ghost shrink-0">Change</button>
      </form>
      {codeMsg && <p className="mt-2 text-muted">{codeMsg}</p>}
      <button type="button" className="mt-8 text-sm text-muted underline" onClick={() => setOrganizerKey(null)}>
        Sign out on this device
      </button>
    </>
  );
}
