-- H2: shared canon for the authenticated player.
-- Adapts codex_for_player(p_share) to be campaign-id based and member-gated on auth.uid(),
-- so a logged-in player can read the revealed canon of any campaign they belong to.
-- Reuses the exact reveal logic: player-visible entries/NPCs plus per-character entry_reveals.

create or replace function public.codex_for_campaign(p_campaign uuid)
returns table (item_kind text, item_type text, id uuid, title text, body text)
language sql
security definer
set search_path to 'public'
as $$
  with gate as (
    -- only members of the campaign see anything
    select p_campaign as cid where public.is_campaign_member(p_campaign)
  ),
  me as (
    select ch.id
    from public.characters ch, gate
    where ch.campaign_id = gate.cid and ch.kind = 'pc' and ch.profile_id = auth.uid()
    limit 1
  ),
  revealed as (
    select er.target_type, er.target_id
    from public.entry_reveals er, me
    where er.revealed_to_character_id = me.id
  )
  select 'entry'::text, e.type, e.id, e.title, e.body
  from public.entries e, gate
  where e.campaign_id = gate.cid
    and (e.visibility in ('common','player')
         or exists (select 1 from revealed r where r.target_type='entry' and r.target_id=e.id))
  union all
  select 'npc'::text, 'npc'::text, ch.id, ch.name, ch.description
  from public.characters ch, gate
  where ch.campaign_id = gate.cid and ch.kind = 'npc'
    and (ch.visibility in ('common','player')
         or exists (select 1 from revealed r where r.target_type='character' and r.target_id=ch.id));
$$;

grant execute on function public.codex_for_campaign(uuid) to authenticated, anon;
