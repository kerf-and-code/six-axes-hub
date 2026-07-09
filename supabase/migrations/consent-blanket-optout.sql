-- Consent upgrade: blanket-at-claim + GM per-session opt-out.
-- Idempotent. Run in the hub SQL editor as one transaction, then commit this file
-- to supabase/migrations/. Matches the hub recording_consents columns:
--   id, campaign_id, session_id, character_id, profile_id, consented, method, recorded_by, created_at

-- Gotcha #1: blanket consent is a NULL-session row, so session_id must allow NULL.
alter table public.recording_consents alter column session_id drop not null;

-- Gotcha #2: plain UNIQUE treats every NULL session_id as distinct, so it cannot
-- dedupe blanket rows. A partial unique index does.
create unique index if not exists recording_consents_blanket_unq
  on public.recording_consents (campaign_id, character_id)
  where session_id is null;

-- The gate: a session is OK when every PRESENT character is either blanket-consented
-- or opted-out, and at least one present character is actually recordable.
create or replace function public.session_consent_ok(p_session uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $function$
  with s as (
    select id, campaign_id from public.sessions where id = p_session
  ),
  present as (
    select a.character_id
    from public.attendance a
    where a.session_id = p_session
      and a.status in ('present', 'late', 'partial')
      and a.character_id is not null
  ),
  blanket as (
    select rc.character_id
    from public.recording_consents rc, s
    where rc.campaign_id = s.campaign_id
      and rc.session_id is null
      and rc.consented
  ),
  optout as (
    select rc.character_id
    from public.recording_consents rc
    where rc.session_id = p_session
      and rc.consented = false
  )
  select
    exists (
      select 1 from present p
      where p.character_id in (select character_id from blanket)
        and p.character_id not in (select character_id from optout)
    )
    and not exists (
      select 1 from present p
      where p.character_id not in (select character_id from blanket)
        and p.character_id not in (select character_id from optout)
    );
$function$;

-- record_consent_for_share: web claim writes a blanket (or per-session) consent row.
-- First parameter is named `code` to match the existing caller (record page), so this
-- CREATE OR REPLACE does not require dropping the function. session lookup uses
-- session_number (the real column). NULL p_session_number => a blanket row.
-- Explicit exists->update/else insert with `is not distinct from` so NULL session
-- matches NULL correctly (gotcha #5).
create or replace function public.record_consent_for_share(
  code text,
  p_session_number int,
  p_character_id uuid,
  p_consented boolean,
  p_method text
)
returns void
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_campaign uuid;
  v_session  uuid;
  v_profile  uuid := auth.uid();
  v_existing uuid;
begin
  select id into v_campaign from public.campaigns where share_code = code;
  if v_campaign is null then raise exception 'invalid share code'; end if;

  if p_session_number is not null then
    select id into v_session
    from public.sessions
    where campaign_id = v_campaign and session_number = p_session_number
    limit 1;
  end if;

  select id into v_existing
  from public.recording_consents
  where campaign_id = v_campaign
    and character_id = p_character_id
    and session_id is not distinct from v_session
  limit 1;

  if v_existing is not null then
    update public.recording_consents
      set consented = p_consented, method = p_method, profile_id = coalesce(profile_id, v_profile)
      where id = v_existing;
  else
    insert into public.recording_consents
      (campaign_id, session_id, character_id, profile_id, consented, method)
    values
      (v_campaign, v_session, p_character_id, v_profile, p_consented, p_method);
  end if;
end;
$function$;

grant execute on function public.record_consent_for_share(text, int, uuid, boolean, text) to authenticated, anon;

-- One-time backfill (gotcha #7): give already-claimed PCs who previously consented a
-- standing blanket row, so the new gate does not read them as un-consented. Idempotent.
insert into public.recording_consents (campaign_id, session_id, character_id, profile_id, consented, method)
select distinct c.campaign_id, null::uuid, c.id, c.profile_id, true, 'backfill_blanket'
from public.characters c
where c.kind = 'pc'
  and exists (select 1 from public.recording_consents rc where rc.character_id = c.id and rc.consented = true)
  and not exists (select 1 from public.recording_consents rc2 where rc2.character_id = c.id and rc2.session_id is null and rc2.consented = true);
