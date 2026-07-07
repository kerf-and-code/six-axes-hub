# The Six Axes Guide

Everything in one place: what each part of the app does, how to set up from scratch, how to run a game night, and how the app builds your world, your prep, and your story as you play.

## What Six Axes is

Six Axes turns what happens at your table into recaps your players actually read and analytics you can act on. It captures two streams: what was said (per-speaker voice from your Discord sessions, or in-person recordings) and what mechanically happened (dice rolls, damage, and hit points from D&D Beyond via Beyond20). Both land on the same session timeline.

And it builds itself as you play. Your Codex fills in with the people, places, and factions you narrate; your prep sheet suggests what to run next; your campaign writes up as a shareable chronicle; and each player gets an honest, play-derived read of how they actually play.

Consent comes first, always. Nothing is recorded until each player agrees, consent is logged per player per session, and you can delete recordings on request. The transcription step is gated on consent being on file.

The name comes from the six axes the disposition model tracks for every character: Voice, Tactics, Arcana, Rapport, Exploration, and Nerve.

## A tour of your side (the GM tabs)

**Table.** Your home base. Start here is the checklist that walks you from an empty account to a running, recorded table. Workspace is where campaigns live. Roster is where you add characters (or let players add their own when they claim), copy each player's personal invite link, bind their profiles, and grab the one session link your whole table uses.

**Play.** Game-night operations. Sessions is the log and recap home: schedule sessions (propose times, players vote in Discord, you confirm), write and send the player recap, and build the shareable campaign journal. Capture holds the upload path. Review is where you approve or reject the events the extractor proposes, and where one click turns a captured NPC, place, or faction into a Codex entry. Check-in (Run the session) is the live runner: go live, mark attendance, and read player check-ins and chat.

**Story.** Your campaign's memory, most of it self-filling. Codex holds people, places, lore, and your cast, and each NPC accretes what your narration said about it. Prep is your next-session sheet: open threads, NPCs in play, the table's boundaries, and a planner you can pre-fill with one tap (Suggest prep). Timeline lays your arcs and loot out session by session. Map is your campaign map: upload the world, drop pins, and link each to a place, NPC, or piece of lore. Search finds anything by name, place, item, or phrase.

**Insight.** The analytics. Dispositions is the model view across the six axes per character, what each player said versus how they actually played; it refreshes on its own after you review a session. Reliability double-codes your transcripts and reports agreement (Cohen's kappa). Dashboard translates everything into plain-language table-health flags. Mechanics is the descriptive dice stats: roll counts, natural 20s and 1s, the d20 distribution, damage dealt, and hit points over the session.

**Profile.** The player disposition instrument (the Profile tab on the player side). Players take it once via their invite link, and their answers bind to their character on the Roster, feeding the disposition model as a starting prior.

## A tour of the player side (one link)

Players get exactly one URL for the whole campaign: the session link you copy from the Roster tab. It opens a flat portal with everything they need.

**Profile.** The one-time questionnaire that ties their play preferences to their character, and where they set their lines and veils.

**Schedule.** Upcoming sessions with RSVP, and the availability polls you post, answered right in Discord.

**Recaps.** Every 'previously on' you have shared, in one place.

**Lore.** The people, places, and lore their character has learned, party-visible entries plus anything you have revealed to them personally.

**Map.** The campaign map, showing only the pins you have made party-visible.

**Journal.** Their story so far: how they actually play (their fitted read across the six axes, drawn from logged sessions, not their self-report), the moments they were part of, and what they have learned.

**Check-in.** A quick post-session pulse: how the session felt, resubmittable.

**Chat.** Private party chat, with visibility windows only if they grant them.

**Record.** The session page. Recording consent lives here, the in-person self-recorder lives here, and the Table Tap lives here: with Beyond20 set up, a player keeps this tab open and their attacks, saves, damage, and HP changes flow into your recaps and Mechanics automatically.

## Set up from scratch

Budget about twenty minutes for you, and two minutes per player. The Start here checklist tracks most of this automatically.

1. Create your account and your campaign in the Table workspace. Name the table, pick the system.
2. Add your players' characters on the Roster, or leave it to them: when a player claims and their character is not listed, they add it themselves. A name per player is enough.
3. Send each player their personal invite link from the Roster (the Copy player invite button). Opening it ties their profile to that character.
4. Connect Discord: invite the Six Axes bot to your server, then run /setup code:<your share code> in the channel where you want recaps and polls posted. Players run /claim once to link their Discord account to their character.
5. Copy the session link from the Roster (the Table Tap card) and pin it in your Discord channel. This is the one link players use all campaign.
6. Have each player who plays through D&D Beyond do the one-time Beyond20 setup: add your site to Beyond20's Custom Domains (the card shows the exact line) and press Apply, then enable D&D Beyond digital dice so captured numbers match what the table sees.
7. Schedule your first session on the Sessions page: propose a few times, players tap the ones they can make in Discord, and you confirm the winner (which creates the session). Tick Make recurring for a standing weekly game.
8. Optional but recommended before your first real night: run a short test. Join voice, /record, say a few words, /stop, and have one player roll something with the session page open. If events show up on Review and a Mechanics row appears, everything is wired.

## Run a game night

Once set up, a session is two Discord commands and a quick review afterward.

1. Before the game: post /session in your Discord channel so the table sees the time in their own timezone and can RSVP.
2. Players open the pinned session link and tap I consent (or use the consent button the bot posts). Players on Beyond20 just leave that tab open in the background.
3. Everyone joins the voice channel, then you run /record. The bot joins, posts the consent notice, and captures each speaker on their own track. It also opens a session automatically and links you as the narrator, and rolls made on D&D Beyond flow in alongside, attributed to each character. To record into a specific session number, add session:2.
4. Play. If someone new joins voice mid-session, nothing breaks; long sessions are captured in rotating chunks automatically.
5. When you wrap, run /stop. The bot uploads per-speaker audio and files the capture, then transcription and event extraction run on their own.
6. Playing in person instead? Skip /record: each player opens the same session link on their phone and uses the self-recorder on the Record page, or upload per-player audio on the Capture page. Same pipeline from there.

## Collect the insights

After a session the raw material becomes readable in this order, and most of it happens on its own:

1. Transcription runs automatically after /stop (or after you queue an upload on Capture). It is consent-gated: only players whose consent is on file for that session are transcribed.
2. Review the proposed events. Extraction starts on its own, so they are usually waiting. Approve, edit, or reject each; use the confidence threshold to accept the obvious ones in a click. While you are here, Accept + create turns any captured NPC, place, or faction into a Codex entry. Mark the session done when the queue is clear.
3. Your player recap is drafted automatically when you mark a session done. Edit and send it from the Session Log, by email, to your Discord channel, or both.
4. Open Insight, then Mechanics for the dice story: who rolled, the d20 distribution, crits and fumbles, damage by type, and each character's hit points. If a roller shows as unlinked, bind them to a character right there.
5. Dispositions refresh on their own after you finish reviewing a session, so the Insight pages stay current.
6. Check Reliability occasionally, and glance at the Dashboard for plain-language flags about table balance.

## Build the world, the prep, and the story

Beyond capturing a session, Six Axes turns what it captured into a living campaign. Most of this is one tap or fully automatic.

**The Codex fills itself.** On Review, Accept + create turns a captured NPC, place, or faction into a Codex entry, deduped by name and seeded from what you narrated. NPCs, locations, and factions all self-populate; you just approve them.

**Plan the next session.** The Prep sheet has a planner: jot the scenes and encounters you mean to run, link them to open threads or NPCs, set a difficulty by feel. Suggest prep pre-fills it in one tap, reading your stale threads and who has been quiet, and phrasing a few beats you can take or leave.

**The Living Map.** On Story, then Map, upload your campaign map and click to drop pins. Link each pin to a place, NPC, or lore entry, and set who can see it. Party-visible pins appear on the players' Map tab.

**Reveals.** On any Codex entry or NPC, Reveal to shows it to a specific player when the story earns it, even while it stays a secret to everyone else. It lands on that player's Lore tab. Party-visible entries already reach the whole table.

**Scheduling.** On Sessions, propose a few times and post the poll to Discord. Players tap what they can make; you see the tally and Confirm the winner, which creates the next session. Tick Make recurring and the next weekly slot fills in on its own.

**The Campaign Journal.** Build the journal on Sessions stitches your recaps into one flowing chronicle, with the arcs, the loot ledger, the nat-20/nat-1 legends, and the cast. It gives you a public link you can share with anyone.

## What to do with them

The point of all this is not the charts. It is five small moves that make the next session better:

1. Open the next session with the recap. Two minutes of 'previously on' gets everyone back in the story and rewards the players who read it early.
2. Balance the spotlight. If Mechanics shows a player rolling half as often as everyone else, or Dispositions shows an axis going quiet, write one scene for them into your next prep (Suggest prep will already be nudging you toward it).
3. Turn the dice into table lore. The nat 1 and nat 20 ledger is shareable gold: call back the fumble, celebrate the clutch 20.
4. Read the HP sparklines as a pacing instrument. If nobody dipped below 75 percent, the night may have been low-stakes; if someone flatlined near zero twice, check the Check-in pulses before turning the difficulty up again.
5. Pick exactly one Dashboard flag per session and address it in prep. One deliberate adjustment a week compounds; five at once is noise.

## Troubleshooting

**The session page says waiting for Beyond20.** The site is not in Beyond20's Custom Domains yet, or Apply was not pressed, or the tab was not reloaded after. Fix all three, in that order. The domain line to add is shown right on the page.

**Rolls show as unverified in Mechanics.** That player has Beyond20 broadcasting formulas instead of results. Have them enable D&D Beyond digital dice in Beyond20's options; from then on their numbers match what the table sees.

**A player's rolls say unlinked.** The session page shows a Link your character picker the moment an unlinked roll arrives, and you can also link a roller from the Mechanics page. Either way, that player's rolls attribute to the character, earlier ones included.

**Recording into the right session.** /record opens a session automatically if none is live. After a false start, run /record session:2 to record into that exact number instead of creating a new one.

**A scheduling poll got no responses.** Players answer in Discord, so the bot must be able to post in your channel and players must have run /claim. If the poll did not appear at all, link the channel with /setup first.

**A player's Lore, Map, or Journal is empty.** Those are per-player and need the player to have claimed their character via their personal invite link. Until they claim, they see only party-visible items and no personal read.

**The bot does not join voice.** Join the voice channel yourself before (or right after) running /record; the bot follows the person who requested the recording. If a recording is stuck, /stop clears it.

**Transcription will not queue.** That is the consent gate working. Check that every attending player has consent logged for this session, via the Capture consent checkboxes or the Discord I consent button.

---

Generated from the in-app guide. Edit lib/help-content.mjs and re-run this script.
