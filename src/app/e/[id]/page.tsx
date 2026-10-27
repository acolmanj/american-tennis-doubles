"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Header, Loading, Page } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useOrganizerKey } from "@/lib/storage";
import { useEventData } from "@/lib/useEventData";

export default function EventHome() {
  const { id } = useParams<{ id: string }>();
  const { event, players, loading } = useEventData(id);
  const organizerKey = useOrganizerKey();
  if (loading) return <Loading />;
  if (!event) return <Page>This night couldn&apos;t be found.</Page>;
  const active = players.filter((p) => p.status !== "withdrawn");
  const present = active.filter((p) => p.status === "present").length;
  const men = active.filter((p) => p.gender === "M").length;

  const links = [
    { href: `/e/${id}/me`, label: "My night", primary: true },
    { href: `/e/${id}/checkin`, label: "Check in" },
    { href: `/e/${id}/signup`, label: "Sign up" },
    { href: `/e/${id}/board`, label: "All rounds" },
    { href: `/e/${id}/rankings`, label: "Rankings" },
  ];

  return (
    <>
      <Header title={event.name} subtitle={[formatDate(event.event_date), event.venue].filter(Boolean).join(" · ")} />
      <Page>
        <div className="card grid grid-cols-3 text-center">
          <Stat value={active.length} label="Signed up" />
          <Stat value={present} label="Here" />
          <Stat value={`${men}/${active.length - men}`} label="Men/Women" />
        </div>
        <p className="mt-4 text-muted">
          {event.courts} courts · {event.rounds} rounds · about {event.round_minutes} minutes each with a {event.break_minutes} minute break
        </p>
        <nav className="mt-6 grid gap-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={l.primary ? "btn-primary" : "btn-ghost"}>
              {l.label}
            </Link>
          ))}
          {organizerKey && (
            <Link href={`/e/${id}/manage`} className="btn-ghost border-dashed">
              Manage night
            </Link>
          )}
        </nav>
      </Page>
    </>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <p className="display text-3xl">{value}</p>
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}
