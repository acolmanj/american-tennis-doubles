-- American doubles: events, players, rounds, matches, sit-outs.
-- Everyone can read (players follow the night on their phones without an account).
-- All writes go through the functions below, which check the organizer passcode
-- or the player's check-in token.

create schema if not exists private;

create table private.config (
  id boolean primary key default true check (id),
  organizer_passcode_hash text not null
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  event_date date,
  venue text,
  courts int not null default 5 check (courts between 1 and 20),
  rounds int not null default 5 check (rounds between 1 and 20),
  round_minutes int not null default 15 check (round_minutes between 1 and 120),
  break_minutes int not null default 5 check (break_minutes between 0 and 60),
  variety int not null default 50 check (variety between 0 and 100),
  mixed_rule boolean not null default true,
  status text not null default 'setup' check (status in ('setup', 'live', 'finished')),
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  gender text not null check (gender in ('M', 'F')),
  level text not null check (level in ('proficient', 'intermediate', 'improver', 'beginner')),
  status text not null default 'registered' check (status in ('registered', 'present', 'withdrawn')),
  group_id uuid,
  token text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);
create index on public.players (event_id);

create table public.rounds (
  event_id uuid not null references public.events (id) on delete cascade,
  round int not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'in_play', 'finished')),
  primary key (event_id, round)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  round int not null,
  court int not null,
  a1 uuid not null references public.players (id),
  a2 uuid not null references public.players (id),
  b1 uuid not null references public.players (id),
  b2 uuid not null references public.players (id),
  score_a int check (score_a between 0 and 99),
  score_b int check (score_b between 0 and 99),
  updated_at timestamptz not null default now(),
  unique (event_id, round, court)
);
create index on public.matches (event_id);

create table public.sit_outs (
  event_id uuid not null references public.events (id) on delete cascade,
  round int not null,
  player_id uuid not null references public.players (id),
  primary key (event_id, round, player_id)
);

alter table public.events enable row level security;
alter table public.players enable row level security;
alter table public.rounds enable row level security;
alter table public.matches enable row level security;
alter table public.sit_outs enable row level security;

create policy "anyone can read events" on public.events for select using (true);
create policy "anyone can read players" on public.players for select using (true);
create policy "anyone can read rounds" on public.rounds for select using (true);
create policy "anyone can read matches" on public.matches for select using (true);
create policy "anyone can read sit-outs" on public.sit_outs for select using (true);

-- Player tokens are never readable from the browser.
revoke select on public.players from anon, authenticated;
grant select (id, event_id, name, gender, level, status, group_id, created_at) on public.players to anon, authenticated;

alter publication supabase_realtime add table public.events, public.players, public.rounds, public.matches, public.sit_outs;

-- Helpers ---------------------------------------------------------------

create function private.check_organizer(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_key is null or not exists (
    select 1 from private.config c
    where c.organizer_passcode_hash = extensions.crypt(p_key, c.organizer_passcode_hash)
  ) then
    raise exception 'Wrong organizer passcode' using errcode = '28000';
  end if;
end $$;

create function public.verify_organizer(p_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_organizer(p_key);
  return true;
exception when sqlstate '28000' then
  return false;
end $$;

create function public.change_organizer_passcode(p_key text, p_new text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_organizer(p_key);
  if length(p_new) < 6 then raise exception 'Passcode must be at least 6 characters'; end if;
  update private.config set organizer_passcode_hash = extensions.crypt(p_new, extensions.gen_salt('bf'));
end $$;

-- Events ----------------------------------------------------------------

create function public.save_event(p_key text, p_event jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := (p_event ->> 'id')::uuid;
begin
  perform private.check_organizer(p_key);
  if v_id is null then
    insert into public.events (name, event_date, venue, courts, rounds, round_minutes, break_minutes, variety, mixed_rule)
    values (
      p_event ->> 'name',
      nullif(p_event ->> 'event_date', '')::date,
      nullif(p_event ->> 'venue', ''),
      coalesce((p_event ->> 'courts')::int, 5),
      coalesce((p_event ->> 'rounds')::int, 5),
      coalesce((p_event ->> 'round_minutes')::int, 15),
      coalesce((p_event ->> 'break_minutes')::int, 5),
      coalesce((p_event ->> 'variety')::int, 50),
      coalesce((p_event ->> 'mixed_rule')::boolean, true)
    )
    returning id into v_id;
  else
    update public.events e set
      name = coalesce(p_event ->> 'name', e.name),
      event_date = case when p_event ? 'event_date' then nullif(p_event ->> 'event_date', '')::date else e.event_date end,
      venue = case when p_event ? 'venue' then nullif(p_event ->> 'venue', '') else e.venue end,
      courts = coalesce((p_event ->> 'courts')::int, e.courts),
      rounds = coalesce((p_event ->> 'rounds')::int, e.rounds),
      round_minutes = coalesce((p_event ->> 'round_minutes')::int, e.round_minutes),
      break_minutes = coalesce((p_event ->> 'break_minutes')::int, e.break_minutes),
      variety = coalesce((p_event ->> 'variety')::int, e.variety),
      mixed_rule = coalesce((p_event ->> 'mixed_rule')::boolean, e.mixed_rule),
      status = coalesce(p_event ->> 'status', e.status),
      published = coalesce((p_event ->> 'published')::boolean, e.published)
    where e.id = v_id;
  end if;
  return v_id;
end $$;

create function public.delete_event(p_key text, p_event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_organizer(p_key);
  delete from public.sit_outs where event_id = p_event_id;
  delete from public.matches where event_id = p_event_id;
  delete from public.events where id = p_event_id;
end $$;

-- Players ---------------------------------------------------------------

-- Public signup: one person can register several players at once.
create function public.register_players(p_event_id uuid, p_players jsonb) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  v_group uuid := gen_random_uuid();
  v_ids uuid[] := '{}';
  v_id uuid;
  p jsonb;
begin
  if not exists (select 1 from public.events where id = p_event_id and status <> 'finished') then
    raise exception 'This event is closed for signup';
  end if;
  if jsonb_array_length(p_players) not between 1 and 12 then
    raise exception 'Sign up between 1 and 12 players at a time';
  end if;
  for p in select * from jsonb_array_elements(p_players) loop
    insert into public.players (event_id, name, gender, level, group_id)
    values (p_event_id, trim(p ->> 'name'), p ->> 'gender', p ->> 'level', v_group)
    returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;
  return v_ids;
end $$;

-- QR check-in: marks the player present, records their level, and hands back
-- the token their phone uses to enter scores.
create function public.check_in(p_player_ids uuid[], p_levels text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_out jsonb := '{}';
  i int;
  v_token text;
begin
  for i in 1 .. coalesce(array_length(p_player_ids, 1), 0) loop
    v_token := null;
    update public.players set
      status = 'present',
      level = coalesce(p_levels[i], level)
    where id = p_player_ids[i] and status <> 'withdrawn'
    returning token into v_token;
    if v_token is not null then
      v_out := v_out || jsonb_build_object(p_player_ids[i]::text, v_token);
    end if;
  end loop;
  return v_out;
end $$;

create function public.organizer_save_player(p_key text, p_event_id uuid, p_player jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := (p_player ->> 'id')::uuid;
begin
  perform private.check_organizer(p_key);
  if v_id is null then
    insert into public.players (event_id, name, gender, level, status)
    values (p_event_id, trim(p_player ->> 'name'), p_player ->> 'gender', p_player ->> 'level',
            coalesce(p_player ->> 'status', 'present'))
    returning id into v_id;
  else
    update public.players p set
      name = coalesce(trim(p_player ->> 'name'), p.name),
      gender = coalesce(p_player ->> 'gender', p.gender),
      level = coalesce(p_player ->> 'level', p.level),
      status = coalesce(p_player ->> 'status', p.status)
    where p.id = v_id and p.event_id = p_event_id;
  end if;
  return v_id;
end $$;

-- Removes a player who has no matches; otherwise marks them withdrawn.
create function public.organizer_remove_player(p_key text, p_player_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_organizer(p_key);
  if exists (select 1 from public.matches m where p_player_id in (m.a1, m.a2, m.b1, m.b2))
     or exists (select 1 from public.sit_outs s where s.player_id = p_player_id) then
    update public.players set status = 'withdrawn' where id = p_player_id;
  else
    delete from public.players where id = p_player_id;
  end if;
end $$;

-- Schedule --------------------------------------------------------------

-- Replaces every round from p_from_round onward. Rounds already started are never touched.
create function public.save_schedule(p_key text, p_event_id uuid, p_from_round int, p_plan jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare r jsonb; m jsonb; s text;
begin
  perform private.check_organizer(p_key);
  if exists (select 1 from public.rounds where event_id = p_event_id and round >= p_from_round and status <> 'upcoming') then
    raise exception 'Round % or later has already started', p_from_round;
  end if;
  -- Unused players from replaced rounds may now be deletable, but matches go first.
  delete from public.matches where event_id = p_event_id and round >= p_from_round;
  delete from public.sit_outs where event_id = p_event_id and round >= p_from_round;
  delete from public.rounds where event_id = p_event_id and round >= p_from_round;
  for r in select * from jsonb_array_elements(p_plan) loop
    insert into public.rounds (event_id, round) values (p_event_id, (r ->> 'round')::int);
    for m in select * from jsonb_array_elements(r -> 'matches') loop
      insert into public.matches (event_id, round, court, a1, a2, b1, b2)
      values (p_event_id, (r ->> 'round')::int, (m ->> 'court')::int,
              (m -> 'teamA' ->> 0)::uuid, (m -> 'teamA' ->> 1)::uuid,
              (m -> 'teamB' ->> 0)::uuid, (m -> 'teamB' ->> 1)::uuid);
    end loop;
    for s in select * from jsonb_array_elements_text(r -> 'sitOuts') loop
      insert into public.sit_outs (event_id, round, player_id) values (p_event_id, (r ->> 'round')::int, s::uuid);
    end loop;
  end loop;
end $$;

-- Swaps two players' places within one round that hasn't started.
create function public.swap_players(p_key text, p_event_id uuid, p_round int, p_x uuid, p_y uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_organizer(p_key);
  if exists (select 1 from public.rounds where event_id = p_event_id and round = p_round and status <> 'upcoming') then
    raise exception 'Round % has already started', p_round;
  end if;
  update public.matches set
    a1 = case a1 when p_x then p_y when p_y then p_x else a1 end,
    a2 = case a2 when p_x then p_y when p_y then p_x else a2 end,
    b1 = case b1 when p_x then p_y when p_y then p_x else b1 end,
    b2 = case b2 when p_x then p_y when p_y then p_x else b2 end
  where event_id = p_event_id and round = p_round;
  update public.sit_outs set player_id = case player_id when p_x then p_y else p_x end
  where event_id = p_event_id and round = p_round and player_id in (p_x, p_y)
    and not (p_x in (select player_id from public.sit_outs where event_id = p_event_id and round = p_round)
         and p_y in (select player_id from public.sit_outs where event_id = p_event_id and round = p_round));
end $$;

create function public.set_round_status(p_key text, p_event_id uuid, p_round int, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_organizer(p_key);
  update public.rounds set status = p_status where event_id = p_event_id and round = p_round;
  if p_status = 'in_play' then
    update public.events set status = 'live' where id = p_event_id and status = 'setup';
  end if;
end $$;

-- Scores: the organizer, or a checked-in player on that court.
create function public.enter_score(p_match_id uuid, p_score_a int, p_score_b int, p_key text default null, p_token text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if p_key is not null then
    perform private.check_organizer(p_key);
  elsif p_token is null or not exists (
    select 1 from public.players p
    where p.token = p_token and p.id in (v_match.a1, v_match.a2, v_match.b1, v_match.b2)
  ) then
    raise exception 'Only players on this court can enter its score';
  end if;
  update public.matches set score_a = p_score_a, score_b = p_score_b, updated_at = now() where id = p_match_id;
end $$;

-- Only the functions are callable from the browser; tables stay read-only.
revoke all on function private.check_organizer(text) from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;
