"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Crest, Loading } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { EventRow } from "@/lib/types";

export default function Home() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [recent, setRecent] = useState<EventRow[]>([]);

  useEffect(() => {
    supabase
      .from("events")
      .select("*")
      .neq("status", "finished")
      .order("event_date", { ascending: true, nullsFirst: false })
      .then(({ data }) => setEvents((data as EventRow[]) ?? []));
    supabase
      .from("events")
      .select("*")
      .eq("status", "finished")
      .order("event_date", { ascending: false, nullsFirst: false })
      .limit(5)
      .then(({ data }) => setRecent((data as EventRow[]) ?? []));
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-12 pt-10">
      <div className="flex flex-col items-center text-center">
        <Crest size={160} />
        <h1 className="display mt-6 text-2xl">American Doubles</h1>
        <p className="mt-1 text-muted">Play, Mix, Enjoy</p>
      </div>
      <div className="divider-waves my-8" aria-hidden />
      <h2 className="display mb-3 text-sm text-muted">Upcoming nights</h2>
      {events === null ? (
        <Loading />
      ) : events.length === 0 ? (
        <p className="text-muted">No nights scheduled yet.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/e/${e.id}`} className="card flex items-center justify-between gap-3 hover:border-white">
                <div className="min-w-0">
                  <p className="truncate text-xl font-bold">{e.name}</p>
                  <p className="text-muted">
                    {[formatDate(e.event_date), e.venue].filter(Boolean).join(" · ")}
                    {e.status === "live" && <span className="ml-2 rounded-full bg-white px-2 text-sm font-bold text-black">LIVE</span>}
                  </p>
                </div>
                <span className="display text-2xl" aria-hidden>
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {recent.length > 0 && (
        <>
          <h2 className="display mb-3 mt-10 text-sm text-muted">Recent results</h2>
          <ul className="space-y-2">
            {recent.map((e) => (
              <li key={e.id}>
                <Link href={`/e/${e.id}`} className="card flex items-center justify-between gap-3 py-3 hover:border-white">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{e.name}</p>
                    <p className="text-sm text-muted">{formatDate(e.event_date)}</p>
                  </div>
                  <span className="shrink-0 text-sm text-muted">Results ›</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-auto pt-12 text-center">
        <Link href="/organizer" className="text-sm text-muted underline underline-offset-4">
          Organizer
        </Link>
      </div>
    </main>
  );
}
