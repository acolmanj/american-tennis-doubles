-- Remember players across nights: a club-wide list of names with their last
-- Male/Female and level, so signup and check-in can fill them in next time.

create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  name_key text not null unique,
  gender text not null check (gender in ('M', 'F')),
  level text not null check (level in ('proficient', 'intermediate', 'improver', 'beginner')),
  updated_at timestamptz not null default now()
);

alter table public.members enable row level security;
create policy "anyone can read members" on public.members for select using (true);

alter table public.players add column member_id uuid references public.members (id);
grant select (member_id) on public.players to anon, authenticated;

-- Creates or updates the member for a name and returns its id.
create function private.remember_member(p_name text, p_gender text, p_level text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.members (name, name_key, gender, level)
  values (trim(p_name), lower(regexp_replace(trim(p_name), '\s+', ' ', 'g')), p_gender, p_level)
  on conflict (name_key) do update set
    name = excluded.name, gender = excluded.gender, level = excluded.level, updated_at = now()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function private.remember_member(text, text, text) from public, anon, authenticated;

-- Keep members in step with every player saved: signup, walk-ins, check-in level changes, organizer edits.
create function private.sync_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.member_id := private.remember_member(new.name, new.gender, new.level);
  return new;
end $$;

create trigger players_sync_member
before insert or update of name, gender, level on public.players
for each row execute function private.sync_member();

-- Existing players, oldest first so the latest night's level wins.
do $$
declare r record;
begin
  for r in select id from public.players order by created_at loop
    update public.players set name = name where id = r.id;
  end loop;
end $$;
