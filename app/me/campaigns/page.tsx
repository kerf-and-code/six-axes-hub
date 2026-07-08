"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageShell from "@/components/page-shell";
import { SAX } from "@/lib/theme";

const C = { surface: SAX.slateBg, line: SAX.line, text: SAX.text, muted: SAX.muted, sun: SAX.sun, plum: SAX.plum, good: SAX.good };

type Membership = { campaign_id: string; profile_id: string; role: string };
type Campaign = { id: string; name: string; system: string | null };
type Profile = { id: string; display_name: string | null };
type Char = { id: string; name: string; campaign_id: string; profile_id: string | null };

type TableMate = { profileId: string; name: string; role: string; character: string | null; isMe: boolean };
type CampaignCard = { id: string; name: string; system: string | null; myRole: string; myChars: string[]; mates: TableMate[] };

export default function MyCampaignsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [cards, setCards] = useState<CampaignCard[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "signed_out" | "error">("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setStatus("signed_out"); return; }
      const uid = user.id;

      // 1. Which campaigns am I in?
      const { data: mine, error: e1 } = await supabase
        .from("memberships")
        .select("campaign_id, profile_id, role")
        .eq("profile_id", uid);
      if (!active) return;
      if (e1) { setStatus("error"); return; }
      const myMemberships = (mine as Membership[]) || [];
      const campaignIds = myMemberships.map((m) => m.campaign_id);
      if (campaignIds.length === 0) { setCards([]); setStatus("ready"); return; }

      // 2. For those campaigns: their names, every member, every character, and member display names.
      //    RLS (is_campaign_member) lets a member read the full roster of a shared campaign.
      const [{ data: camps }, { data: allMembers }, { data: allChars }] = await Promise.all([
        supabase.from("campaigns").select("id, name, system").in("id", campaignIds),
        supabase.from("memberships").select("campaign_id, profile_id, role").in("campaign_id", campaignIds),
        supabase.from("characters").select("id, name, campaign_id, profile_id").in("campaign_id", campaignIds).eq("kind", "pc").eq("active", true),
      ]);
      if (!active) return;

      const members = (allMembers as Membership[]) || [];
      const chars = (allChars as Char[]) || [];
      const profileIds = Array.from(new Set(members.map((m) => m.profile_id)));
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", profileIds);
      if (!active) return;
      const nameOf = new Map<string, string>();
      ((profs as Profile[]) || []).forEach((p) => nameOf.set(p.id, p.display_name?.trim() || "Unnamed"));

      const charsByOwner = (cid: string, pid: string) =>
        chars.filter((ch) => ch.campaign_id === cid && ch.profile_id === pid).map((ch) => ch.name);

      const built: CampaignCard[] = (camps as Campaign[] || []).map((c) => {
        const mine2 = myMemberships.find((m) => m.campaign_id === c.id);
        const mates: TableMate[] = members
          .filter((m) => m.campaign_id === c.id)
          .map((m) => {
            const ownChars = charsByOwner(c.id, m.profile_id);
            return {
              profileId: m.profile_id,
              name: nameOf.get(m.profile_id) || "Unnamed",
              role: m.role,
              character: ownChars.length ? ownChars.join(", ") : null,
              isMe: m.profile_id === uid,
            };
          })
          .sort((a, b) => (a.isMe === b.isMe ? a.name.localeCompare(b.name) : a.isMe ? -1 : 1));
        return {
          id: c.id,
          name: c.name,
          system: c.system,
          myRole: mine2?.role || "player",
          myChars: charsByOwner(c.id, uid),
          mates,
        };
      }).sort((a, b) => a.name.localeCompare(b.name));

      setCards(built);
      setStatus("ready");
    })();
    return () => { active = false; };
  }, [supabase]);

  const eyebrow = { fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: C.muted };
  const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px", marginBottom: 14 };
  const roleTag = (role: string) => ({
    fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" as const,
    color: role === "gm" ? C.sun : C.muted,
  });

  return (
    <PageShell width={920}>
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <span style={{ fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 26, fontWeight: 700 }}>Your campaigns</span>
        </div>
        <div style={{ ...eyebrow, textAlign: "center", marginBottom: 18 }}>THE TABLES YOU SIT AT</div>
        <div style={{ height: 3, borderRadius: 3, background: `linear-gradient(90deg, ${C.sun}, ${C.plum})`, marginBottom: 24 }} />

        {status === "loading" && <p style={{ textAlign: "center", color: C.muted, fontSize: 14 }}>Loading&hellip;</p>}
        {status === "error" && <p style={{ textAlign: "center", color: C.muted, fontSize: 14 }}>Something went wrong loading your campaigns. Please refresh to try again.</p>}
        {status === "signed_out" && (
          <p style={{ textAlign: "center", color: C.muted, fontSize: 14, lineHeight: 1.6 }}>
            <a href="/auth/login" style={{ color: C.sun }}>Sign in</a> to see the campaigns you play in.
          </p>
        )}

        {status === "ready" && cards.length === 0 && (
          <div style={{ ...card, color: C.muted, fontSize: 13.5, lineHeight: 1.6, textAlign: "center" }}>
            You&rsquo;re not in any campaigns yet. Claim a character with the invite link your GM sent, and the table will appear here.
          </div>
        )}

        {status === "ready" && cards.map((c) => (
          <div key={c.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{c.name}</span>
              <span style={roleTag(c.myRole)}>{c.myRole === "gm" ? "You GM" : "Player"}</span>
            </div>
            {c.system && <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{c.system}</div>}
            {c.myChars.length > 0 && (
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
                Playing as <span style={{ color: C.text }}>{c.myChars.join(", ")}</span>
              </div>
            )}

            <div style={{ ...eyebrow, marginBottom: 8 }}>AT THE TABLE</div>
            <div style={{ display: "grid", gap: 6 }}>
              {c.mates.map((m) => (
                <div key={m.profileId} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, paddingBottom: 6, borderBottom: `1px solid ${C.line}` }}>
                  <span style={{ fontSize: 14, color: m.isMe ? C.text : C.muted }}>
                    {m.name}{m.isMe ? " (you)" : ""}
                    {m.character && <span style={{ color: C.muted }}> &middot; {m.character}</span>}
                  </span>
                  <span style={roleTag(m.role)}>{m.role === "gm" ? "GM" : "Player"}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
