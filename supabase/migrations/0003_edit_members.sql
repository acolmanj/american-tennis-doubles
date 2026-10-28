-- Organizer edits to the club player list: fix spelling, Male/Female and level.
-- Renaming someone to a name the club already knows merges the two entries.
-- Name and Male/Female corrections also carry over to the nights they played; levels on past nights stay as they were.

create function public.organizer_save_member(p_key text, p_id uuid, p_name text, p_gender text, p_level text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := regexp_replace(trim(p_name), '\s+', ' ', 'g');
  v_key text := lower(regexp_replace(trim(p_name), '\s+', ' ', 'g'));
  v_other uuid;
begin
  perform private.check_organizer(p_key);
  if length(v_name) = 0 then raise exception 'Name can''t be empty'; end if;
  if p_gender not in ('M', 'F') then raise exception 'Choose Male or Female'; end if;
  if p_level not in ('proficient', 'intermediate', 'improver', 'beginner') then raise exception 'Choose a level'; end if;

  select id into v_other from public.members where name_key = v_key and id <> p_id;
  if v_other is not null then
    -- Same person under two spellings: keep one entry and move everyone over to it.
    update public.players set member_id = v_other where member_id = p_id;
    delete from public.members where id = p_id;
    p_id := v_other;
  end if;

  update public.members set name = v_name, name_key = v_key where id = p_id;
  -- Saving a player re-syncs their member (see players_sync_member), so the member's own values are set last.
  update public.players set name = v_name, gender = p_gender
  where member_id = p_id and (name <> v_name or gender <> p_gender);
  update public.members set name = v_name, gender = p_gender, level = p_level, updated_at = now() where id = p_id;
  return p_id;
end $$;

create function public.organizer_delete_member(p_key text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_organizer(p_key);
  update public.players set member_id = null where member_id = p_id;
  delete from public.members where id = p_id;
end $$;
