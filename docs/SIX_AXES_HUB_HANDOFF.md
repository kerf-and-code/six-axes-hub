# Six Axes Hub — Handoff & State of Build

**Purpose:** This document lets a fresh Claude Code session (connected directly to the repo) pick up work on the Six Axes Hub with full context, no re-discovery needed. Read it top to bottom once, then work from it.

**Repo:** `github.com/kerf-and-code/six-axes-hub` · **Local:** `C:\Users\Test\wrangler\six-axes-hub` (Windows, Git Bash MINGW64)
**Live:** `six-axes-hub.vercel.app` · **Org:** Kerf and Code LLC · **Vercel account:** `roman-matthews-projects`

---

## 0. What this project is

Six Axes turns what happens at a tabletop RPG session into **recaps players read** and **analytics the GM can act on**, and increasingly a **self-building campaign** (Codex, prep, map, journal). It captures two streams onto one session timeline:

1. **What was said** — per-speaker Discord voice (or in-person recordings) → Deepgram transcription → Claude event extraction.
2. **What mechanically happened** — dice/damage/HP from D&D Beyond via the Beyond20 extension (the "Table Tap").

Consent is gated per player; transcription won't run without it. The name comes from the six disposition axes scored per character: **Voice, Tactics, Arcana, Rapport, Exploration, Nerve** (internal keys N/T/O/S/E/I, branded TAVERN).

**The hub vs the pilot.** There are two fully isolated deployments:
- **Pilot ("pc-wrangler"):** the original, proven app. Repo `kerf-and-code/pc-wrangler`, Supabase ref `agafmvywayisxgvrfium` (us-west-2), live `pc-wrangler.vercel.app`, Fly app `six-axes-sidecar`. **NEVER touch the pilot when working on the hub.** Accidentally working in the pilot repo was a recurring failure mode — always confirm the working directory is `six-axes-hub`.
- **Hub ("Six Axes Hub"):** the production build, a clean-room twin of the pilot. This document is about the hub. It was stood up from scratch and now has the full pipeline working end to end.

---

## 1. Hub infrastructure (all live and isolated)

| Layer | Value |
|---|---|
| Repo | `kerf-and-code/six-axes-hub` |
| Local path | `C:\Users\Test\wrangler\six-axes-hub` |
| Web app | Next.js App Router (`cacheComponents` ON) + TypeScript, on Vercel Pro (`six-axes-hub.vercel.app`) |
| Supabase ref | `acbvivevwwrunolwpikk` (region **us-east-2**) |
| Supabase pooler host | `aws-1-us-east-2.pooler.supabase.com` (IPv4; use this, not the direct IPv6 host) |
| Supabase user | `postgres.acbvivevwwrunolwpikk` |
| Anthropic model | `claude-sonnet-4-6` |
| Transcription | Deepgram (nova-3) |
| Voice sidecar | Fly.io app **`six-axes-hub-sidecar`**, region `sjc`, machine id `86e349fe991de8` |
| Discord bot | "Six Axes Hub#5840" (its own app, NOT the pilot's) |
| Email | Resend, verified sending domain **`send.kerfandcode.com`** |
| Test Discord server | dedicated server, guild id `1524458377269346435`, channel #the-dark-crystal id `1524475970369749142` |

**Client uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** (not ANON_KEY).

**Player identity model:** players are anonymous-but-authenticated on the pilot, but on the **hub they get real authenticated accounts** (Google/Discord/magic-link). `handle_new_user` trigger creates a `profiles` row on signup. `claim_character_invite(p_code)` binds `characters.profile_id = auth.uid()`. Per-character reads resolve the caller via `profile_id = auth.uid()` inside SECURITY DEFINER RPCs.

### Env vars set on hub Vercel (Production + Preview)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `ANTHROPIC_API_KEY` (freshly rotated, valid), `DEEPGRAM_API_KEY` (freshly rotated, valid), `TRANSCRIBE_CALLBACK_SECRET`, `DISCORD_APP_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_API`.

### Env vars NOT yet set on the hub (needed later)
- `RESEND_API_KEY` — needed for **email** recap send (Discord recap posting works without it).
- `CRON_SECRET` — needed for scheduled session reminders.
- `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_SA_KEY_B64`, `GCP_DISPOSITION_JOB` — needed for the R/Stan disposition/analytics Cloud Run job.
- `TRANSCRIBE_CALLBACK_BASE` — deliberately NOT set (defaults to request origin = hub, which is correct).

### Fly sidecar secrets (set)
`DISCORD_BOT_TOKEN` (hub bot), `SUPABASE_URL=https://acbvivevwwrunolwpikk.supabase.co`, `SUPABASE_SERVICE_ROLE_KEY` (hub).

---

## 2. Current status — what works end to end

The **entire capture-to-recap pipeline is live and proven on the hub:**

1. **Auth** — Google, Discord, magic-link all working (magic-link via Resend SMTP, sender `no-reply@send.kerfandcode.com`).
2. **Player hub features (H1/H2)** — under the "You" nav group: `/me/campaigns`, `/me/characters`, `/me/threads` (full CRUD, inline edit, owner-only RLS), `/me/codex`, `/me/settings` (display-name editor).
3. **Consent system (upgraded)** — blanket-consent-at-claim + GM per-session opt-out, enforced across all six surfaces (web claim, Discord `/claim` and `/record`, GM capture opt-out toggles, player record page, and the transcription submit route which excludes opted-out audio).
4. **Voice capture** — Discord bot + Fly sidecar capture per-speaker tracks to the `session-audio` bucket, attributed to GM identity or claimed PC.
5. **Transcription** — consent-gated, Deepgram, writes `transcript_segments`. Proven with real recordings.
6. **Extraction** — `/api/extract-gm` reads GM-track segments, calls Claude, writes `gm_proposed_events`; `/api/extract` does the player equivalent → `proposed_events`. Proven: a test session extracted 23 GM narration events.
7. **Review** — `/gm/review` shows proposed events (player + GM tabs) with accept/reject and "Accept & create" entity creation.
8. **Recap** — generates from accepted events (Claude), displays on `/gm/sessions`. **Recap-to-Discord posting just built** (see §4).

---

## 3. Known gotchas (hard-won; do not relearn these)

- **Wrong-repo trap:** always verify you're in `six-axes-hub`, not `pc-wrangler`. This caused multiple "mysterious non-changes."
- **Deploy paths differ:** web app → `git push` → Vercel auto-deploys. Sidecar → `fly deploy` from local `sidecar/` folder (NOT git; Fly builds from disk).
- **Catalog tables must be seeded** on a fresh DB or UIs silently break: `event_types`, `gm_event_kinds`, `class_capabilities` all needed seeding. Symptom: extractor/coverage/subclass pickers return nothing. Seeded via `pg_dump --data-only` through the pooler.
- **`default auth.uid()` on a column does NOT resolve through PostgREST.** Send `profile_id` explicitly on insert (hit on `threads` and consent rows).
- **Discord voice tracking needs `intents.members = True`** in `sidecar.py` AND Server Members Intent enabled in the portal AND the bot re-invited with View Channels/Connect/Speak. Symptom: "Seeded 0 voice location(s)" / "tracking 0" forever.
- **Fly sidecar:** must be exactly ONE machine (destroy extras, `fly scale count 1`). Missing secrets cause `KeyError` crash-loops that look like deploy failures. Logs don't always stream live (close/reopen).
- **API keys that fail auth surface as generic errors** — added `diag`/error-visibility to `submit` and `extract-gm` routes to expose the real 401. Both Deepgram and Anthropic keys were invalid at first and needed fresh keys (Deepgram: `INVALID_AUTH`; Anthropic: `invalid x-api-key`). The `diag` block in `extract-gm/route.ts` is worth keeping.
- **`session_consent_ok` gate needs an `attendance` row** for the present character, or it reads NOT CLEARED even with valid consent (spec gotcha #6). Mark attendance on Check-in, or insert a `present` row.
- **`entries.created_by` is NOT NULL** — every Codex-entry insert must set the GM uid.
- **`proposed_events.event_type` is an FK to `event_types`** — only catalog keys, not free text.
- **Player event text lives in `payload.rationale` (jsonb); `gm_events` uses a real `summary` column.** Two shapes.
- **Two "done" statuses:** sessions land as `completed` OR `processed` — status filters must accept both.
- **Schema constraints:** `capture_jobs.source` ∈ {online, in_person}; `audio_tracks.status` ∈ {pending, transcribing, done, error}; `vtt_events.fidelity` ∈ {canonical, unverified}; `capture_control.status` ∈ {requested, done, ...}.
- **`cacheComponents` ON** forbids dynamic APIs outside `<Suspense>` during prerender.

---

## 4. Most recent work (this session)

**Recap-to-Discord posting — built, ready to deploy (may already be deployed; verify).** The two send paths were separated:
- **New route `app/api/recap/post-discord/route.ts`** — Discord-only, owner-gated, reads `campaigns.discord_channel_id`, calls the existing `lib/discord/post.ts` `postRecapToDiscord()` helper (uses `DISCORD_BOT_TOKEN`, posts themed embeds, chunks >4000 chars). No email/RESEND dependency.
- **`app/api/recap/send/route.ts`** — made email-only (removed the Discord side-post so the two are independent).
- **`app/gm/sessions/page.tsx`** — added a `postToDiscord()` handler and a **"Post to Discord"** button in the recap card (saves current text first, then posts, so GM inline edits go through). Email input/button unchanged.

Commit line used:
```
git add app/api/recap/post-discord/route.ts app/api/recap/send/route.ts app/gm/sessions/page.tsx
git commit -m "Recap: separate Discord post and email into independent actions with own buttons"
git push
```
**Verify:** click "Post to Discord" on a recap → should appear in channel `1524475970369749142` as an embed. If it fails, ensure the bot has Send Messages + Embed Links in that channel.

`lib/discord/post.ts` and `campaigns.discord_channel_id` (= `1524475970369749142` for The Dark Crystal) both confirmed present and hub-correct.

---

## 5. Phasing plan & desired outcome

**Desired outcome:** the hub becomes the production Six Axes — a player-first campaign hub that pairs the proven GM capture/analytics pipeline with player-facing features nobody else ships, ultimately gated into pricing tiers (DM package / player package / both).

Order of work (user's stated priority: finish small deferred items, then the differentiator, then cleanup):

**Immediate / in progress**
1. ✅/verify: Recap-to-Discord button (§4).

**Next major build — the differentiator**
2. **Analytics / disposition surface (Insight).** This is the moat and the reason the pipeline exists. Now unblocked because real event data is flowing (`gm_proposed_events`/`events` populate from sessions). Build the player-facing and GM-facing disposition read (prior-vs-posterior across the six axes), spotlight equity, engagement. The pilot has `app/gm/dispositions`, `reliability`, `dashboard`, `mechanics` and the R/Stan Cloud Run job to model on. Needs `GCP_*` env vars for the disposition fit job (not yet set on hub). Reuse the pilot's pattern: definer RPCs, `dispositions` table (source prior|posterior, axis_scores), `disposition_runs`, SQL views (`v_session_equity`, `v_session_spotlight`, `v_session_axis_engagement`, `v_session_gini`).
3. **Shared recap surface (H2 remainder).** Player-visible "what happened last session" fed by accepted events.

**Cleanup (non-blocking, do when convenient)**
4. **Spec 6.2 opt-out filter on both extractors** — `extract/route.ts` and `extract-gm/route.ts` should drop segments whose `character_id` is in the session's opt-out set before calling Claude. (submit route already does track-level exclusion; segment-level in extractors is the remaining piece.)
5. **Rotate secrets that passed through terminals/chat:** hub DB password, hub bot token, hub service-role key. (Anthropic + Deepgram keys already rotated fresh.)
6. **Revoke old/invalid Anthropic + Deepgram keys** in their consoles.
7. **Add missing env vars** as features need them: `RESEND_API_KEY` (email recaps), `CRON_SECRET` (reminders), `GCP_*` (disposition job).
8. **Custom domain** `hub.six-axes.com` (user owns six-axes.com; currently on the vercel.app URL).
9. **Commit missing migrations / repo hygiene:** ensure all SQL run directly in Supabase is also committed to `supabase/migrations/` for reproducibility. `.gitignore` excludes `schema.sql`, `seed.sql`, `class_seed.sql`, `supabase/.temp/`.
10. **Remove dead files (confirm unused first):** `app/gm/sessions.tsx` (stray beside the real one), root `proxy.ts`, `components/wrangler-nav.tsx`, `components/TPDI_Instrument.jsx`, retired `app/gm/power/`.

**Needs a real pilot/population first:** C1 population layer (cross-table norms), Cohen's kappa tuning, posterior maturation (needs several logged sessions).

---

## 6. Supabase reference (schema)

Cloned from pilot: **37 functions, 6 views, 39 tables, 62 policies** (+ storage/auth policies added separately). Buckets: `session-audio` (private), `campaign-maps` (public). Anonymous auth ON. `on_auth_user_created` trigger on `auth.users` runs `handle_new_user`.

**Views (6):** `v_session_equity`, `v_session_spotlight`, `v_session_axis_engagement`, `v_session_gini`, `v_arc_freshness`, `v_loot_fairness`.

**Key tables by area:**
- **Campaign core:** `campaigns` (share_code, recur_rule, discord_channel_id, discord_guild_id, gm_id), `characters` (kind pc/npc, profile_id, invite_code, discord_user_id, visibility, class/subclass/species/level/alignment/build), `sessions` (session_number, status, recap, scheduled_at), `attendance` (campaign_id, session_id, character_id, profile_id, status), `class_capabilities`, `gm_identities`.
- **Capture:** `capture_jobs` (source, status, extract_cursor, gm_extract_cursor), `capture_control` (guild_id, requested_by_discord_id, status, capture_job_id), `audio_tracks` (gm_identity_id, character_id, status, duration_seconds, storage_path), `transcript_segments` (job_id, track_id, character_id, start_ms, end_ms, text).
- **Events spine:** `event_types` (FK target), `proposed_events` (player; text in `payload.rationale`), `events`, `gm_event_kinds` (22 kinds seeded), `gm_proposed_events` (kind, summary, npc_name, location_name, faction_name, confidence, status), `gm_events` (summary, kind, thread_status).
- **Dispositions:** `tpdi_responses`, `dispositions` (source prior|posterior, axis_scores, weights), `disposition_runs`.
- **Codex/world:** `entries` (type, created_by NOT NULL, visibility, tags), `entity_links` (source/target type+id, relation), `entry_reveals` (per-character reveals).
- **Story:** `arcs`, `arc_touches`, `loot_grants`.
- **Mechanics:** `vtt_events` (fidelity, rolls jsonb).
- **Phase A/B:** `session_polls` + `poll_responses`, `session_plan_items`, `maps` + `map_pins`, `campaign_journals`.
- **Chat:** `chat_messages`, `chat_grants`.
- **Consent:** `recording_consents` (campaign_id, session_id [nullable], character_id, profile_id, consented, method, recorded_by). Partial unique index `recording_consents_blanket_unq` on (campaign_id, character_id) WHERE session_id IS NULL. Blanket row = session_id NULL + consented true; opt-out = session_id set + consented false.

**Key RPCs:** `is_campaign_gm`, `is_campaign_member`, `claim_character_invite`, `my_character(p_share)`, `my_characters()` [hub-added, cross-campaign dossier], `handle_new_user`, `record_consent_for_share(code, p_session_number, p_character_id, p_consented, p_method)`, `session_consent_ok(p_session)`, `codex_for_player(p_share)`, `codex_for_campaign(p_campaign)` [hub-added], `review_proposed_event`, plus the player-portal share-code family.

---

## 7. File-location map (key paths)

**GM app (`app/gm/`):** `page.tsx` Workspace · `sessions/page.tsx` recap+scheduling+journal · `capture/page.tsx` upload + consent opt-out toggles · `review/page.tsx` accept queue · `roster/` cast+invites+Table Tap · `codex/` `prep/` `timeline/` `map/` `search/` · `dispositions/ reliability/ dashboard/ mechanics/` (Insight) · `table/` Check-in · `start/` onboarding.

**Player app:** `me/campaigns` `me/characters` `me/threads` `me/codex` `me/settings` (hub "You" group) · `play/` Profile · `schedule/ recaps/ lore/ map/ vibe/ chat/ record/` · `join/page.tsx` invite claim + consent step · `table/[code]/` Table Tap · `journal/[share]/` public chronicle.

**API (`app/api/`):** `extract/` + `extract-gm/` extractors · `gm-review/` accept+create · `recap/` + `recap/send/` (email) + `recap/post-discord/` (Discord, new) · `journal/build/` · `prep/suggest/` · `dispositions/run/` · `schedule/poll/` + `schedule/confirm/` · `vtt/ingest|link/` · `record/start|finish/` · `transcribe/submit|callback/` · `recode/` · `discord/interactions/` · `cron/session-reminders/`.

**Components:** `six-axes-nav.tsx` (nav; "You" group added) · `page-shell.tsx` · `table-tap*.tsx` · `gm-identity-card.tsx` · `ui/` shadcn primitives.

**Lib:** `recap/build.ts` · `journal/build.ts` · `discord/post.ts` (recap→Discord) · `schedule/poll-message.ts` · `supabase/{server,client,admin}.ts` · `theme.ts` (exports `SAX`, `surfaces`, `ui`).

**Infra:** `sidecar/` (Dockerfile, fly.toml [app=six-axes-hub-sidecar], sidecar.py [py-cord pinned branch fix/voice-rec-2, intents.members=True]) · `scripts/register-discord-commands.mjs` · `supabase/migrations/` (includes h1-player-threads, h2-codex-for-campaign, consent-blanket-optout).

---

## 8. Working conventions (the user's strong preferences)

- **Provide COMPLETE files to save, never snippets.** Every change = the whole file.
- **Always include exact `git add`/`commit`/`push` lines** with explicit file paths (no `git add .`).
- **Ask before modifying an existing file** — request current contents first rather than guessing.
- **Show specific evidence/diagnostics BEFORE proposing a fix.** Verify state, then one targeted change. Don't guess.
- **No em-dashes in prose** (use commas, colons, parentheses).
- **Style idiom:** inline styles via the `SAX` theme object (`slateBg`, `line`, `text`, `muted`, `sun`, `plum`, `good`, `serif`, `brass`), `PageShell`, hand-built cards, `createClient()` + `useMemo`, RPC-first reads for complex/aggregated data, direct table reads for simple owner-only CRUD. NOT shadcn for player pages.
- Player characters are "Bobert" variants; prefers Chaotic Good.

---

## 9. Test data (The Dark Crystal campaign)

- Campaign id `a5fc4f34-7b4d-4db2-8588-f2232f1f700a`, name "The Dark Crystal", discord_channel_id `1524475970369749142`.
- Session id `e8a53740-cd83-4673-b77a-b44eb1a6fb3b` (Session 1).
- Character "Bobert Gelfling" id `a4423eff-99d7-4840-af66-cd5f76b5ac54` (claimed, blanket consent, attendance present).
- GM identity id `5c70600f-004b-4d9a-8de1-9dc8734045c6`.
- Latest capture job `e8ab9884-7fb0-4cd0-92de-eff59606d7de` — transcribed, 23 GM events extracted, in `review`.

---

## 10. Quick-start for Claude Code

1. Confirm working dir is `six-axes-hub` (NOT `pc-wrangler`).
2. Read §5 for what's next: verify recap-to-Discord, then build the analytics/disposition surface.
3. Follow §8 conventions religiously (complete files, git lines, no guessing, no em-dashes, SAX idiom).
4. Watch §3 gotchas.
5. Deploy: web → git push (Vercel auto). Sidecar → `fly deploy` from `sidecar/`.
6. Fly logs: `fly logs -a six-axes-hub-sidecar`. Machine: `86e349fe991de8`.
