"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageShell from "@/components/page-shell";
import { SAX } from "@/lib/theme";

const C = { surface: SAX.slateBg, line: SAX.line, text: SAX.text, muted: SAX.muted, sun: SAX.sun, plum: SAX.plum, good: SAX.good };

export default function MySettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [initial, setInitial] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "ready" | "signed_out" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setStatus("signed_out"); return; }
      setUserId(user.id);
      setEmail(user.email || "");
      const { data, error } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
      if (!active) return;
      if (error) { setStatus("error"); return; }
      const name = (data?.display_name as string) || "";
      setDisplayName(name);
      setInitial(name);
      setStatus("ready");
    })();
    return () => { active = false; };
  }, [supabase]);

  const dirty = displayName.trim() !== initial.trim();

  async function save() {
    if (!userId || saving || !dirty) return;
    setSaving(true);
    setSaved(false);
    const value = displayName.trim() || null;
    const { error } = await supabase.from("profiles").update({ display_name: value, updated_at: new Date().toISOString() }).eq("id", userId);
    setSaving(false);
    if (error) return;
    setInitial(displayName.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const eyebrow = { fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: C.muted };
  const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "18px 20px", marginBottom: 14 };
  const input = { width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 15, fontFamily: "inherit" as const };
  const label = { ...eyebrow, display: "block", marginBottom: 6 };

  return (
    <PageShell width={920}>
      <div style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <span style={{ fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 26, fontWeight: 700 }}>Your settings</span>
        </div>
        <div style={{ ...eyebrow, textAlign: "center", marginBottom: 18 }}>HOW THE TABLE SEES YOU</div>
        <div style={{ height: 3, borderRadius: 3, background: `linear-gradient(90deg, ${C.sun}, ${C.plum})`, marginBottom: 24 }} />

        {status === "loading" && <p style={{ textAlign: "center", color: C.muted, fontSize: 14 }}>Loading&hellip;</p>}
        {status === "error" && <p style={{ textAlign: "center", color: C.muted, fontSize: 14 }}>Something went wrong loading your settings. Please refresh to try again.</p>}
        {status === "signed_out" && (
          <p style={{ textAlign: "center", color: C.muted, fontSize: 14, lineHeight: 1.6 }}>
            <a href="/auth/login" style={{ color: C.sun }}>Sign in</a> to manage your profile.
          </p>
        )}

        {status === "ready" && (
          <div style={card}>
            <label style={label}>Display name</label>
            <input
              style={input}
              placeholder="The name your table sees"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
              maxLength={60}
            />
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
              This is how you appear on campaign rosters and shared views.
            </div>

            {email && (
              <div style={{ marginTop: 16 }}>
                <label style={label}>Signed in as</label>
                <div style={{ fontSize: 14, color: C.muted }}>{email}</div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 18 }}>
              <button
                onClick={save}
                disabled={!dirty || saving}
                style={{ background: dirty && !saving ? C.sun : "rgba(255,255,255,0.08)", color: dirty && !saving ? "#1a1204" : C.muted, border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 14, cursor: dirty && !saving ? "pointer" : "default" }}
              >
                {saving ? "Saving\u2026" : "Save"}
              </button>
              {saved && <span style={{ color: C.good, fontSize: 13 }}>Saved</span>}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
