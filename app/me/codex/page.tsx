"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageShell from "@/components/page-shell";
import { SAX } from "@/lib/theme";

const C = { surface: SAX.slateBg, line: SAX.line, text: SAX.text, muted: SAX.muted, sun: SAX.sun, plum: SAX.plum, good: SAX.good };

type Campaign = { id: string; name: string };
type CodexItem = { item_kind: string; item_type: string; id: string; title: string; body: string | null };

export default function MyCodexPage() {
  const supabase = useMemo(() => createClient(), []);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState<string>("");
  const [items, setItems] = useState<CodexItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "signed_out" | "error">("loading");
  const [loadingCodex, setLoadingCodex] = useState(false);

  // load the player's campaigns for the picker
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setStatus("signed_out"); return; }
      const { data: mine, error } = await supabase.from("memberships").select("campaign_id").eq("profile_id", user.id);
      if (!active) return;
      if (error) { setStatus("error"); return; }
      const ids = ((mine as { campaign_id: string }[]) || []).map((m) => m.campaign_id);
      if (ids.length === 0) { setCampaigns([]); setStatus("ready"); return; }
      const { data: camps } = await supabase.from("campaigns").select("id, name").in("id", ids).order("name", { ascending: true });
      if (!active) return;
      const list = (camps as Campaign[]) || [];
      setCampaigns(list);
      if (list.length) setCampaignId(list[0].id);
      setStatus("ready");
    })();
    return () => { active = false; };
  }, [supabase]);

  // load codex whenever the selected campaign changes
  useEffect(() => {
    if (!campaignId) { setItems([]); return; }
    let active = true;
    (async () => {
      setLoadingCodex(true);
      const { data, error } = await supabase.rpc("codex_for_campaign", { p_campaign: campaignId });
      if (!active) return;
      setItems(error ? [] : ((data as CodexItem[]) || []));
      setLoadingCodex(false);
    })();
    return () => { active = false; };
  }, [campaignId, supabase]);

  const lore = items.filter((it) => it.item_kind === "entry");
  const npcs = items.filter((it) => it.item_kind === "npc");

  const eyebrow = { fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: C.muted };
  const sectionTitle = { fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 18, fontWeight: 700, color: C.text, margin: "28px 0 10px" };
  const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 18px", marginBottom: 10 };
  const input = { width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 15, fontFamily: "inherit" as const };

  const renderItem = (it: CodexItem) => (
    <div key={it.id} style={card}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: it.body ? 5 : 0 }}>
        {it.title}
        {it.item_kind === "entry" && it.item_type && it.item_type !== "note" && (
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginLeft: 8 }}>{it.item_type}</span>
        )}
      </div>
      {it.body && <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{it.body}</div>}
    </div>
  );

  return (
    <PageShell width={920}>
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <span style={{ fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 26, fontWeight: 700 }}>Codex</span>
        </div>
        <div style={{ ...eyebrow, textAlign: "center", marginBottom: 18 }}>WHAT YOUR TABLE KNOWS</div>
        <div style={{ height: 3, borderRadius: 3, background: `linear-gradient(90deg, ${C.sun}, ${C.plum})`, marginBottom: 24 }} />

        {status === "loading" && <p style={{ textAlign: "center", color: C.muted, fontSize: 14 }}>Loading&hellip;</p>}
        {status === "error" && <p style={{ textAlign: "center", color: C.muted, fontSize: 14 }}>Something went wrong loading the codex. Please refresh to try again.</p>}
        {status === "signed_out" && (
          <p style={{ textAlign: "center", color: C.muted, fontSize: 14, lineHeight: 1.6 }}>
            <a href="/auth/login" style={{ color: C.sun }}>Sign in</a> to see the lore your table has uncovered.
          </p>
        )}

        {status === "ready" && campaigns.length === 0 && (
          <div style={{ ...card, color: C.muted, fontSize: 13.5, lineHeight: 1.6, textAlign: "center" }}>
            You&rsquo;re not in any campaigns yet. Once you join a table, its revealed lore and NPCs will appear here.
          </div>
        )}

        {status === "ready" && campaigns.length > 0 && (
          <>
            {campaigns.length > 1 && (
              <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} style={{ ...input, marginBottom: 8 }}>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}

            {loadingCodex ? (
              <p style={{ textAlign: "center", color: C.muted, fontSize: 14, marginTop: 20 }}>Loading&hellip;</p>
            ) : items.length === 0 ? (
              <div style={{ ...card, color: C.muted, fontSize: 13.5, lineHeight: 1.6, textAlign: "center" }}>
                Nothing revealed yet. As your GM shares lore and you meet people, they&rsquo;ll gather here.
              </div>
            ) : (
              <>
                {lore.length > 0 && <div style={sectionTitle}>Lore</div>}
                {lore.map(renderItem)}
                {npcs.length > 0 && <div style={sectionTitle}>People you&rsquo;ve met</div>}
                {npcs.map(renderItem)}
              </>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
