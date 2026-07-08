-- H1: player-first hub. Personal threads table + cross-campaign dossier RPC.
-- Idempotent. Safe to run in the hub SQL editor, then commit to supabase/migrations/.
-- Matches existing conventions: uuid PK via gen_random_uuid(), profile_id -> profiles,
-- campaign_id -> campaigns ON DELETE CASCADE, timestamptz defaults, SECURITY DEFINER + search_path.

-- 1. Personal threads: a player's own plot threads, favors, grudges, hooks.
create table if not exists public.threads (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  campaign_id  uuid references public.campaigns(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  title        text not null,
  detail       text,
  kind         text not null default 'thread',
  status       text not null default 'open',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists threads_profile_idx  on public.threads (profile_id);
create index if not exists threads_campaign_idx on public.threads (campaign_id);

-- Owner-only. Threads are purely personal in H1 (no GM visibility yet).
alter table public.threads enable row level security;

drop policy if exists "threads_select_own" on public.threads;
create policy "threads_select_own" on public.threads
  for select using (profile_id = auth.uid());

drop policy if exists "threads_insert_own" on public.threads;
create policy "threads_insert_own" on public.threads
  for insert with check (profile_id = auth.uid());

drop policy if exists "threads_update_own" on public.threads;
create policy "threads_update_own" on public.threads
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "threads_delete_own" on public.threads;
create policy "threads_delete_own" on public.threads
  for delete using (profile_id = auth.uid());

grant select, insert, update, delete on public.threads to authenticated;

-- 2. The dossier read: every character this player owns, across all campaigns.
--    Distinct from my_character(p_share), which is single-campaign / single-result.
create or replace function public.my_characters()
returns table (
  character_id  uuid,
  name          text,
  campaign_id   uuid,
  campaign_name text,
  species       text,
  class         text,
  subclass      text,
  level         smallint,
  alignment     text,
  kind          text,
  active        boolean
)
language sql
security definer
set search_path to 'public'
as $$
  select ch.id, ch.name, c.id, c.name,
         ch.species, ch.class, ch.subclass, ch.level, ch.alignment, ch.kind, ch.active
  from public.characters ch
  join public.campaigns c on c.id = ch.campaign_id
  where ch.profile_id = auth.uid()
  order by c.name, ch.name;
$$;

grant execute on function public.my_characters() to authenticated, anon;
