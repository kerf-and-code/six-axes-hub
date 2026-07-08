"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageShell from "@/components/page-shell";
import { SAX } from "@/lib/theme";

const C = { surface: SAX.slateBg, line: SAX.line, text: SAX.text, muted: SAX.muted, sun: SAX.sun, plum: SAX.plum, good: SAX.good };

const KINDS: { value: string; label: string }[] = [
  { value: "thread", label: "Thread" },
  { value: "favor_owed", label: "Owed to me" },
  { value: "favor_owing", label: "I owe" },
  { value: "grudge", label: "Grudge" },
  { value: "hook", label: "Loose end" },
];
const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

type Thread = {
  id: string;
  campaign_id: string | null;
  character_id: string | null;
  title: string;
  detail: string | null;
  kind: string;
  status: string;
  created_at: string;
};
type Character = { character_id: string; name: string; campaign_id: string; campaign_name: string };
type Draft = { title: string; detail: string; kind: string; campaignId: string; characterId: string };

const EMPTY_DRAFT: Draft = { title: "", detail: "", kind: "thread", campaignId: "", characterId: "" };

export default function MyThreadsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [chars, setChars] = useState<Character[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "signed_out" | "error">("loading");

  // new-thread form
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  // inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setStatus("signed_out"); return; }
      const [{ data: t, error: tErr }, { data: cs }] = await Promise.all([
        supabase.from("threads").select("*").order("created_at", { ascending: false }),
        supabase.rpc("my_characters"),
      ]);
      if (!active) return;
      if (tErr) { setStatus("error"); return; }
      setThreads((t as Thread[]) || []);
      setChars((cs as Character[]) || []);
      setStatus("ready");
    })();
    return () => { active = false; };
  }, [supabase]);

  const campaigns = useMemo(() => {
    const m = new Map<string, string>();
    for (const ch of chars) m.set(ch.campaign_id, ch.campaign_name);
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [chars]);

  const charsFor = (cid: string) => (cid ? chars.filter((ch) => ch.campaign_id === cid) : []);
  const campaignName = (id: string | null) => campaigns.find((c) => c.id === id)?.name || null;
  const charName = (id: string | null) => chars.find((c) => c.character_id === id)?.name || null;

  async function addThread() {
    if (!draft.title.trim() || saving) return;
    setSaving(true);
    const row = {
      title: draft.title.trim(),
      detail: draft.detail.trim() || null,
      kind: draft.kind,
      campaign_id: draft.campaignId || null,
      character_id: draft.characterId || null,
    };
    // profile_id is filled by the column default (auth.uid()) and enforced by RLS.
    const { data, error } = await supabase.from("threads").insert(row).select("*").single();
    setSaving(false);
    if (error) return;
    setThreads((prev) => [data as Thread, ...prev]);
    setDraft(EMPTY_DRAFT);
  }

  function startEdit(t: Thread) {
    setEditingId(t.id);
    setEditDraft({
      title: t.title,
      detail: t.detail || "",
      kind: t.kind,
      campaignId: t.campaign_id || "",
      characterId: t.character_id || "",
    });
  }

  async function saveEdit(t: Thread) {
    if (!editDraft.title.trim()) return;
    const patch = {
      title: editDraft.title.trim(),
      detail: editDraft.detail.trim() || null,
      kind: editDraft.kind,
      campaign_id: editDraft.campaignId || null,
      character_id: editDraft.characterId || null,
      updated_at: new Date().toISOString(),
    };
    setThreads((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
    setEditingId(null);
    await supabase.from("threads").update(patch).eq("id", t.id);
  }

  async function toggleStatus(t: Thread) {
    const next = t.status === "open" ? "resolved" : "open";
    setThreads((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    await supabase.from("threads").update({ status: next, updated_at: new Date().toISOString() }).eq("id", t.id);
  }

  async function remove(t: Thread) {
    setThreads((prev) => prev.filter((x) => x.id !== t.id));
    await supabase.from("threads").delete().eq("id", t.id);
  }

  const eyebrow = { fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: C.muted };
  const sectionTitle = { fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 18, fontWeight: 700, color: C.text, margin: "28px 0 10px" };
  const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 18px", marginBottom: 10 };
  const input = { width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 14, fontFamily: "inherit" as const };
  const label = { ...eyebrow, display: "block", marginBottom: 6 };
  const linkBtn = (color: string) => ({ background: "none", border: "none", color, fontSize: 12.5, cursor: "pointer", padding: 0 });
  const primaryBtn = (enabled: boolean) => ({ background: enabled ? C.sun : "rgba(255,255,255,0.08)", color: enabled ? "#1a1204" : C.muted, border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700 as const, fontSize: 14, cursor: enabled ? "pointer" : "default" });

  // shared field group used by both the add form and the inline editor
  const fields = (d: Draft, set: (d: Draft) => void) => (
    <>
      <input style={input} placeholder="What are you tracking? (e.g. The baron owes me a favor)" value={d.title} onChange={(e) => set({ ...d, title: e.target.value })} />
      <textarea style={{ ...input, marginTop: 8, minHeight: 60, resize: "vertical" }} placeholder="Details (optional)" value={d.detail} onChange={(e) => set({ ...d, detail: e.target.value })} />
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <select style={{ ...input, width: "auto", flex: "1 1 140px" }} value={d.kind} onChange={(e) => set({ ...d, kind: e.target.value })}>
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <select style={{ ...input, width: "auto", flex: "1 1 160px" }} value={d.campaignId} onChange={(e) => set({ ...d, campaignId: e.target.value, characterId: "" })}>
          <option value="">No campaign</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {charsFor(d.campaignId).length > 0 && (
          <select style={{ ...input, width: "auto", flex: "1 1 160px" }} value={d.characterId} onChange={(e) => set({ ...d, characterId: e.target.value })}>
            <option value="">No character</option>
            {charsFor(d.campaignId).map((ch) => <option key={ch.character_id} value={ch.character_id}>{ch.name}</option>)}
          </select>
        )}
      </div>
    </>
  );

  const open = threads.filter((t) => t.status === "open");
  const resolved = threads.filter((t) => t.status !== "open");

  const renderThread = (t: Thread) => {
    if (editingId === t.id) {
      return (
        <div key={t.id} style={card}>
          <label style={label}>Edit thread</label>
          {fields(editDraft, setEditDraft)}
          <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
            <button onClick={() => saveEdit(t)} disabled={!editDraft.title.trim()} style={primaryBtn(!!editDraft.title.trim())}>Save</button>
            <button onClick={() => setEditingId(null)} style={linkBtn(C.muted)}>Cancel</button>
          </div>
        </div>
      );
    }
    return (
      <div key={t.id} style={{ ...card, opacity: t.status === "open" ? 1 : 0.55 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text, textDecoration: t.status === "open" ? "none" : "line-through" }}>{t.title}</span>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.12em", color: C.muted, whiteSpace: "nowrap" }}>{KIND_LABEL[t.kind] || t.kind}</span>
        </div>
        {t.detail && <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, marginTop: 5, whiteSpace: "pre-wrap" }}>{t.detail}</div>}
        {(campaignName(t.campaign_id) || charName(t.character_id)) && (
          <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
            {[charName(t.character_id), campaignName(t.campaign_id)].filter(Boolean).join(" \u00b7 ")}
          </div>
        )}
        <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
          <button onClick={() => toggleStatus(t)} style={linkBtn(C.good)}>{t.status === "open" ? "Resolve" : "Reopen"}</button>
          <button onClick={() => startEdit(t)} style={linkBtn(C.muted)}>Edit</button>
          <button onClick={() => remove(t)} style={linkBtn(C.muted)}>Delete</button>
        </div>
      </div>
    );
  };

  return (
    <PageShell width={920}>
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <span style={{ fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 26, fontWeight: 700 }}>Your threads</span>
        </div>
        <div style={{ ...eyebrow, textAlign: "center", marginBottom: 18 }}>WHAT YOU&rsquo;RE CHASING</div>
        <div style={{ height: 3, borderRadius: 3, background: `linear-gradient(90deg, ${C.sun}, ${C.plum})`, marginBottom: 24 }} />

        {status === "loading" && <p style={{ textAlign: "center", color: C.muted, fontSize: 14 }}>Loading&hellip;</p>}
        {status === "error" && <p style={{ textAlign: "center", color: C.muted, fontSize: 14 }}>Something went wrong loading your threads. Please refresh to try again.</p>}
        {status === "signed_out" && (
          <p style={{ textAlign: "center", color: C.muted, fontSize: 14, lineHeight: 1.6 }}>
            <a href="/auth/login" style={{ color: C.sun }}>Sign in</a> to track your plot threads, favors, and loose ends.
          </p>
        )}

        {status === "ready" && (
          <>
            {/* new thread */}
            <div style={card}>
              <label style={label}>New thread</label>
              {fields(draft, setDraft)}
              <button onClick={addThread} disabled={!draft.title.trim() || saving} style={{ ...primaryBtn(!!draft.title.trim() && !saving), marginTop: 12 }}>
                {saving ? "Adding\u2026" : "Add thread"}
              </button>
            </div>

            {threads.length === 0 && (
              <div style={{ ...card, color: C.muted, fontSize: 13.5, textAlign: "center" }}>
                Nothing tracked yet. Add the favors you&rsquo;re owed, the debts you carry, and the loose ends you mean to chase.
              </div>
            )}

            {open.length > 0 && <div style={sectionTitle}>Open</div>}
            {open.map(renderThread)}

            {resolved.length > 0 && <div style={sectionTitle}>Resolved</div>}
            {resolved.map(renderThread)}
          </>
        )}
      </div>
    </PageShell>
  );
}
