"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageShell from "@/components/page-shell";
import { SAX } from "@/lib/theme";

const C = { surface: SAX.slateBg, line: SAX.line, text: SAX.text, muted: SAX.muted, sun: SAX.sun, plum: SAX.plum, good: SAX.good };

type Character = {
  character_id: string;
  name: string;
  campaign_id: string;
  campaign_name: string;
  species: string | null;
  class: string | null;
  subclass: string | null;
  level: number | null;
  alignment: string | null;
  kind: string;
  active: boolean;
};

export default function MyCharactersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [chars, setChars] = useState<Character[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "signed_out" | "error">("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setStatus("signed_out"); return; }
      const { data, error } = await supabase.rpc("my_characters");
      if (!active) return;
      if (error) { setStatus("error"); return; }
      setChars((data as Character[]) || []);
      setStatus("ready");
    })();
    return () => { active = false; };
  }, [supabase]);

  const eyebrow = { fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: C.muted };
  const sectionTitle = { fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 18, fontWeight: 700, color: C.text, margin: "28px 0 10px" };
  const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 18px", marginBottom: 10 };

  const byCampaign = useMemo(() => {
    const m = new Map<string, { name: string; items: Character[] }>();
    for (const ch of chars) {
      if (!m.has(ch.campaign_id)) m.set(ch.campaign_id, { name: ch.campaign_name, items: [] });
      m.get(ch.campaign_id)!.items.push(ch);
    }
    return Array.from(m.values());
  }, [chars]);

  const subtitle = (ch: Character) => {
    const bits: string[] = [];
    if (ch.level != null) bits.push(`Level ${ch.level}`);
    if (ch.species) bits.push(ch.species);
    if (ch.class) bits.push(ch.subclass ? `${ch.class} (${ch.subclass})` : ch.class);
    return bits.join(" \u00b7 ");
  };

  return (
    <PageShell width={920}>
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <span style={{ fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 26, fontWeight: 700 }}>Your characters</span>
        </div>
        <div style={{ ...eyebrow, textAlign: "center", marginBottom: 18 }}>EVERY TABLE, ONE PLACE</div>
        <div style={{ height: 3, borderRadius: 3, background: `linear-gradient(90deg, ${C.sun}, ${C.plum})`, marginBottom: 24 }} />

        {status === "loading" && <p style={{ textAlign: "center", color: C.muted, fontSize: 14 }}>Loading&hellip;</p>}
        {status === "error" && <p style={{ textAlign: "center", color: C.muted, fontSize: 14 }}>Something went wrong loading your characters. Please refresh to try again.</p>}
        {status === "signed_out" && (
          <p style={{ textAlign: "center", color: C.muted, fontSize: 14, lineHeight: 1.6 }}>
            <a href="/auth/login" style={{ color: C.sun }}>Sign in</a> to see your characters across every campaign.
          </p>
        )}

        {status === "ready" && chars.length === 0 && (
          <div style={{ ...card, color: C.muted, fontSize: 13.5, lineHeight: 1.6, textAlign: "center" }}>
            No characters yet. Claim one with the invite link your GM sent, and it will appear here alongside any others you play.
          </div>
        )}

        {status === "ready" && byCampaign.map((grp, gi) => (
          <div key={gi}>
            <div style={sectionTitle}>{grp.name}</div>
            {grp.items.map((ch) => (
              <div key={ch.character_id} style={{ ...card, opacity: ch.active ? 1 : 0.6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{ch.name}</span>
                  {!ch.active && <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.14em", color: C.muted }}>RETIRED</span>}
                </div>
                {subtitle(ch) && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{subtitle(ch)}</div>}
                {ch.alignment && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{ch.alignment}</div>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </PageShell>
  );
}
