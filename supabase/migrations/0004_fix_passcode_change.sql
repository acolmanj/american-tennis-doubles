-- Supabase refuses an UPDATE with no WHERE clause, so changing the organizer passcode failed.
-- private.config has a single row (id = true); name it.
create or replace function public.change_organizer_passcode(p_key text, p_new text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_organizer(p_key);
  if length(p_new) < 6 then raise exception 'Passcode must be at least 6 characters'; end if;
  update private.config set organizer_passcode_hash = extensions.crypt(p_new, extensions.gen_salt('bf')) where id;
end $$;
