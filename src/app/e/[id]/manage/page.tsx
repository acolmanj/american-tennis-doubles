"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Court } from "@/components/Court";
import { NameField, nameKey } from "@/components/NameField";
import { RoundControls } from "@/components/RoundControls";
import { RoundsSummary } from "@/components/RoundsSummary";
import { ErrorNote, Header, LevelBadge, Loading, Page, SectionTitle } from "@/components/ui";
import { generateSchedule, PlannedRound } from "@/lib/pairing";
import { useOrganizerKey } from "@/lib/storage";
import { rpc } from "@/lib/supabase";
import { EventRow, Gender, GENDER_LABELS, Level, LEVEL_LABELS, LEVELS, MatchRow, PlayerRow } from "@/lib/types";
import { EventData, useEventData } from "@/lib/useEventData";

export default function ManagePage() {
  const { id } = useParams<{ id: string }>();
  const organizerKey = useOrganizerKey();
  const data = useEventData(id);
  if (data.loading) return <Loading />;
  if (!data.event) return <Page>This night couldn&apos;t be found.</Page>;
  if (!organizerKey) {
    return (
      <Page>
        <p className="mb-4">Sign in as the organizer first.</p>
        <Link href="/organizer" className="btn-primary">
          Organizer sign in
        </Link>
      </Page>
    );
  }
  return (
    <>
      <Header title={data.event.name} subtitle="Manage night" back={`/e/${id}`} wide />
      <Page wide>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div>
            <CheckInQr eventId={id} />
            <Settings key={JSON.stringify(data.event)} event={data.event} organizerKey={organizerKey} />
            <Players data={data} organizerKey={organizerKey} />
          </div>
          <div>
            <Schedule data={data} organizerKey={organizerKey} />
          </div>
        </div>
      </Page>
    </>
  );
}

function CheckInQr({ eventId }: { eventId: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [big, setBig] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    const base = window.location.origin;
    QRCode.toDataURL(`${base}/e/${eventId}/checkin`, { width: 640, margin: 2, color: { dark: "#000000", light: "#ffffff" } }).then((url) => {
      setOrigin(base);
      setQr(url);
    });
  }, [eventId]);
  if (!qr) return null;
  return (
    <section className="card">
      <h2 className="display mb-3 text-sm">Check-in QR code</h2>
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR code for check-in" className="h-32 w-32 rounded-lg" />
        <div className="space-y-2 text-sm">
          <button className="btn-primary btn-small w-full" onClick={() => setBig(true)}>
            Show full screen
          </button>
          <p className="break-all text-muted">Signup link: {origin}/e/{eventId}/signup</p>
        </div>
      </div>
      {big && (
        <button className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black p-6" onClick={() => setBig(false)}>
          <p className="display mb-6 text-2xl">Scan to check in</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code for check-in" className="w-full max-w-[80vmin] rounded-2xl" />
          <p className="mt-6 text-muted">Tap to close</p>
        </button>
      )}
    </section>
  );
}

function Settings({ event, organizerKey }: { event: EventRow; organizerKey: string }) {
  const [form, setForm] = useState(event);
  const [msg, setMsg] = useState<string | null>(null);
  const num = (k: keyof EventRow, label: string, min: number, max: number) => (
    <label className="block">
      <span className="label">{label}</span>
      <input className="field" type="number" min={min} max={max} value={form[k] as number} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} />
    </label>
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await rpc("save_event", { p_key: organizerKey, p_event: form });
      setMsg("Saved.");
    } catch (err) {
      setMsg((err as Error).message);
    }
  }
  return (
    <form onSubmit={save} className="mt-6 space-y-4">
      <h2 className="display text-sm text-muted">Settings</h2>
      <label className="block">
        <span className="label">Name</span>
        <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Date</span>
          <input className="field" type="date" value={form.event_date ?? ""} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
        </label>
        {num("courts", "Courts", 1, 20)}
        {num("rounds", "Rounds", 1, 20)}
        {num("round_minutes", "Round (min)", 1, 120)}
        {num("break_minutes", "Break (min)", 0, 60)}
      </div>
      <div>
        <span className="label">Pairing</span>
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={form.variety}
          onChange={(e) => setForm({ ...form, variety: Number(e.target.value) })}
          className="w-full accent-white"
          aria-label="Close games versus meeting everyone"
        />
        <div className="flex justify-between text-sm text-muted">
          <span>Close games</span>
          <span>Meet everyone</span>
        </div>
      </div>
      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" className="h-6 w-6 accent-white" checked={form.mixed_rule} onChange={(e) => setForm({ ...form, mixed_rule: e.target.checked })} />
        <span>Mixed pairs (one man, one woman) where numbers allow</span>
      </label>
      <button className="btn-primary w-full">Save settings</button>
      {msg && <p className="text-muted">{msg}</p>}
    </form>
  );
}

function Players({ data, organizerKey }: { data: EventData; organizerKey: string }) {
  const { event, players } = data;
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("M");
  const [level, setLevel] = useState<Level>("intermediate");
  const [error, setError] = useState<string | null>(null);
  const active = players.filter((p) => p.status !== "withdrawn");
  const present = active.filter((p) => p.status === "present");

  async function savePlayer(p: Partial<PlayerRow>) {
    setError(null);
    try {
      await rpc("organizer_save_player", { p_key: organizerKey, p_event_id: event!.id, p_player: p });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove(p: PlayerRow) {
    if (!window.confirm(`Remove ${p.name} from tonight?`)) return;
    try {
      await rpc("organizer_remove_player", { p_key: organizerKey, p_player_id: p.id });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await savePlayer({ name: name.trim(), gender, level, status: "present" });
    setName("");
  }

  return (
    <section>
      <SectionTitle>
        Players · {present.length} here of {active.length} · {present.filter((p) => p.gender === "M").length} men, {present.filter((p) => p.gender === "F").length} women here
      </SectionTitle>
      <form onSubmit={add} className="card mb-4 space-y-3">
        <NameField
          placeholder="Add a walk-in"
          value={name}
          onChange={setName}
          onRemembered={(g, l) => {
            setGender(g);
            setLevel(l);
          }}
          exclude={new Set(active.map((p) => nameKey(p.name)))}
        />
        <div className="grid grid-cols-2 gap-2">
          <select className="field" value={gender} onChange={(e) => setGender(e.target.value as Gender)} aria-label="Male or female">
            {(["M", "F"] as Gender[]).map((g) => (
              <option key={g} value={g}>
                {GENDER_LABELS[g]}
              </option>
            ))}
          </select>
          <select className="field" value={level} onChange={(e) => setLevel(e.target.value as Level)} aria-label="Level">
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABELS[l]}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-ghost btn-small w-full">Add and mark here</button>
      </form>
      <ErrorNote message={error} />
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {active.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <button
              className={`chip min-h-9 px-3 ${p.status === "present" ? "" : "text-muted"}`}
              aria-pressed={p.status === "present"}
              onClick={() => savePlayer({ id: p.id, status: p.status === "present" ? "registered" : "present" })}
              title="Mark here / not here"
            >
              {p.status === "present" ? "Here" : "Not yet"}
            </button>
            <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
            <select className="rounded-lg border border-line bg-card px-2 py-1" value={p.gender} onChange={(e) => savePlayer({ id: p.id, gender: e.target.value as Gender })} aria-label={`${p.name} male or female`}>
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
            <span className="flex items-center gap-1">
              <LevelBadge level={p.level} />
              <select className="rounded-lg border border-line bg-card px-2 py-1" value={p.level} onChange={(e) => savePlayer({ id: p.id, level: e.target.value as Level })} aria-label={`${p.name} level`}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABELS[l]}
                  </option>
                ))}
              </select>
            </span>
            <button className="px-2 text-muted" onClick={() => remove(p)} aria-label={`Remove ${p.name}`}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function toPlanned(matches: MatchRow[], sitOuts: { round: number; player_id: string }[], round: number): PlannedRound {
  return {
    round,
    matches: matches
      .filter((m) => m.round === round)
      .map((m) => ({ court: m.court, teamA: [m.a1, m.a2], teamB: [m.b1, m.b2] })),
    sitOuts: sitOuts.filter((s) => s.round === round).map((s) => s.player_id),
  };
}

function swapIn(plan: PlannedRound[], round: number, x: string, y: string): PlannedRound[] {
  const sw = (id: string) => (id === x ? y : id === y ? x : id);
  return plan.map((r) =>
    r.round !== round
      ? r
      : {
          ...r,
          matches: r.matches.map((m) => ({
            ...m,
            teamA: [sw(m.teamA[0]), sw(m.teamA[1])],
            teamB: [sw(m.teamB[0]), sw(m.teamB[1])],
          })),
          sitOuts: r.sitOuts.map(sw),
        },
  );
}

function Schedule({ data, organizerKey }: { data: EventData; organizerKey: string }) {
  const { event, players, rounds, matches, sitOuts, playerById } = data;
  const [preview, setPreview] = useState<PlannedRound[] | null>(null);
  const [picked, setPicked] = useState<{ round: number; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const present = players.filter((p) => p.status === "present");
  const started = rounds.filter((r) => r.status !== "upcoming").map((r) => r.round);
  const fromRound = (started.length ? Math.max(...started) : 0) + 1;
  const saved = useMemo(() => rounds.map((r) => toPlanned(matches, sitOuts, r.round)), [rounds, matches, sitOuts]);

  function draw() {
    setError(null);
    if (present.length < 4) {
      setError("Mark at least 4 players as here first.");
      return;
    }
    const played = saved.filter((r) => started.includes(r.round));
    const plan = generateSchedule(
      present.map((p) => ({ id: p.id, gender: p.gender, level: p.level })),
      { courts: event!.courts, rounds: event!.rounds, variety: event!.variety, mixed: event!.mixed_rule },
      played,
    );
    if (!plan.length) setError("There are no rounds left to draw.");
    setPreview(plan);
  }

  async function publish() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await rpc("save_schedule", { p_key: organizerKey, p_event_id: event!.id, p_from_round: fromRound, p_plan: preview });
      await rpc("save_event", { p_key: organizerKey, p_event: { id: event!.id, published: true } });
      setPreview(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function tapPlayer(round: number, id: string, isPreview: boolean) {
    if (!picked || picked.round !== round) {
      setPicked({ round, id });
      return;
    }
    if (picked.id === id) {
      setPicked(null);
      return;
    }
    const x = picked.id;
    setPicked(null);
    if (isPreview) {
      setPreview((p) => p && swapIn(p, round, x, id));
    } else {
      try {
        await rpc("swap_players", { p_key: organizerKey, p_event_id: event!.id, p_round: round, p_x: x, p_y: id });
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }

  const showing = preview ?? saved;
  const isPreview = !!preview;
  const asMatch = (r: number, m: PlannedRound["matches"][number]): MatchRow => {
    const real = matches.find((x) => x.round === r && x.court === m.court);
    return {
      id: `${r}-${m.court}`,
      event_id: event!.id,
      round: r,
      court: m.court,
      a1: m.teamA[0],
      a2: m.teamA[1],
      b1: m.teamB[0],
      b2: m.teamB[1],
      score_a: isPreview ? null : real?.score_a ?? null,
      score_b: isPreview ? null : real?.score_b ?? null,
    };
  };
  const editable = (round: number) => isPreview || rounds.find((r) => r.round === round)?.status === "upcoming";

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {isPreview ? (
          <>
            <button className="btn-primary" onClick={publish} disabled={busy}>
              Publish rounds
            </button>
            <button className="btn-ghost" onClick={draw}>
              Draw again
            </button>
            <button className="text-muted underline" onClick={() => setPreview(null)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="btn-primary" onClick={draw}>
              {rounds.length ? (started.length ? `Redraw from round ${fromRound}` : "Redraw all rounds") : "Draw rounds"}
            </button>
            <RoundControls eventId={event!.id} organizerKey={organizerKey} rounds={rounds} />
          </>
        )}
      </div>
      <p className="mb-4 text-sm text-muted">
        {isPreview
          ? "Preview only: players can't see this yet. Tap two players in the same round to swap them."
          : rounds.length
            ? "Tap two players in a round that hasn't started to swap them. Redraw after late arrivals or players leaving; played rounds stay as they are."
            : `${present.length} players are marked here. Draw when everyone has checked in.`}
      </p>
      <ErrorNote message={error} />
      <div className="mb-6">
        <RoundsSummary plan={isPreview ? [...saved.filter((r) => started.includes(r.round)), ...showing] : saved} playerById={playerById} />
      </div>
      <div className="space-y-8">
        {showing
          .filter((r) => !isPreview || r.round >= fromRound)
          .map((r) => {
            const status = rounds.find((x) => x.round === r.round)?.status;
            return (
              <div key={r.round}>
                <h3 className="display mb-4 text-xl">
                  Round {r.round}
                  {status && !isPreview && <span className="ml-3 text-sm text-muted">{status.replace("_", " ")}</span>}
                </h3>
                <div className="grid gap-5 sm:grid-cols-2">
                  {r.matches.map((m) => (
                    <Court
                      key={m.court}
                      match={asMatch(r.round, m)}
                      playerById={playerById}
                      onPlayerTap={editable(r.round) ? (pid) => tapPlayer(r.round, pid, isPreview) : undefined}
                      selectedId={picked?.round === r.round ? picked.id : null}
                    />
                  ))}
                </div>
                {r.sitOuts.length > 0 && (
                  <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted">Sitting out:</span>
                    {r.sitOuts.map((pid) =>
                      editable(r.round) ? (
                        <button
                          key={pid}
                          className={`rounded px-1 underline ${picked?.round === r.round && picked.id === pid ? "outline-2 outline-dashed outline-white" : ""}`}
                          onClick={() => tapPlayer(r.round, pid, isPreview)}
                        >
                          {playerById.get(pid)?.name}
                        </button>
                      ) : (
                        <span key={pid}>{playerById.get(pid)?.name}</span>
                      ),
                    )}
                  </p>
                )}
              </div>
            );
          })}
      </div>
    </section>
  );
}
