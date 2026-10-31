-- Organizer tools: pre-select entrants, copy a night, fresh start, and check-in only for open nights.

-- Adds players to a night as entered but not here yet ("Not yet"). Names already entered are skipped;
-- someone who had been removed is put back.
create function public.organizer_add_players(p_key text, p_event_id uuid, p_players jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  p jsonb;
  v_name text;
  v_added int := 0;
begin
  perform private.check_organizer(p_key);
  for p in select * from jsonb_array_elements(p_players) loop
    v_name := regexp_replace(trim(p ->> 'name'), '\s+', ' ', 'g');
    update public.players set status = 'registered'
    where event_id = p_event_id and lower(name) = lower(v_name) and status = 'withdrawn';
    if not exists (select 1 from public.players where event_id = p_event_id and lower(name) = lower(v_name)) then
      insert into public.players (event_id, name, gender, level, status)
      values (p_event_id, v_name, p ->> 'gender', p ->> 'level', 'registered');
      v_added := v_added + 1;
    end if;
  end loop;
  return v_added;
end $$;

-- New night with another night's settings and, if asked, its players (all "Not yet"),
-- using each player's current club name, Male/Female and level.
create function public.copy_event(p_key text, p_from uuid, p_name text, p_date date, p_with_players boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.check_organizer(p_key);
  insert into public.events (name, event_date, venue, courts, rounds, round_minutes, break_minutes, variety, mixed_rule)
  select p_name, p_date, venue, courts, rounds, round_minutes, break_minutes, variety, mixed_rule
  from public.events where id = p_from
  returning id into v_id;
  if v_id is null then raise exception 'Night to copy not found'; end if;
  if p_with_players then
    insert into public.players (event_id, name, gender, level, status)
    select v_id, coalesce(m.name, p.name), coalesce(m.gender, p.gender), coalesce(m.level, p.level), 'registered'
    from public.players p left join public.members m on m.id = p.member_id
    where p.event_id = p_from and p.status <> 'withdrawn';
  end if;
  return v_id;
end $$;

-- Fresh start. Keeping the draw clears every score and sets all rounds back to not started;
-- otherwise the draw goes too and the rounds can be drawn again. Players stay entered.
create function public.reset_event(p_key text, p_event_id uuid, p_keep_draw boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_organizer(p_key);
  if p_keep_draw then
    update public.matches set score_a = null, score_b = null, updated_at = now() where event_id = p_event_id;
    update public.rounds set status = 'upcoming' where event_id = p_event_id;
  else
    delete from public.sit_outs where event_id = p_event_id;
    delete from public.matches where event_id = p_event_id;
    delete from public.rounds where event_id = p_event_id;
  end if;
  update public.events set status = 'setup', published = false where id = p_event_id;
end $$;

-- Check-in only for nights that aren't finished (signup already works this way).
create or replace function public.check_in(p_player_ids uuid[], p_levels text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_out jsonb := '{}';
  i int;
  v_token text;
begin
  for i in 1 .. coalesce(array_length(p_player_ids, 1), 0) loop
    v_token := null;
    update public.players p set
      status = 'present',
      level = coalesce(p_levels[i], p.level)
    where p.id = p_player_ids[i] and p.status <> 'withdrawn'
      and exists (select 1 from public.events e where e.id = p.event_id and e.status <> 'finished')
    returning p.token into v_token;
    if v_token is not null then
      v_out := v_out || jsonb_build_object(p_player_ids[i]::text, v_token);
    end if;
  end loop;
  if v_out = '{}' and coalesce(array_length(p_player_ids, 1), 0) > 0 then
    raise exception 'Check-in is closed for this night';
  end if;
  return v_out;
end $$;
