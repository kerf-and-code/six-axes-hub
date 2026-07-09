import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  let jobId: string | undefined;
  try {
    const b = await req.json();
    jobId = b?.jobId;
  } catch {
    /* fall through to the missing-jobId guard */
  }
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  // Authorize via RLS: only the campaign GM can read this job row.
  const supa = await createClient();
  const { data: job } = await supa
    .from("capture_jobs")
    .select("id, campaign_id, session_id")
    .eq("id", jobId)
    .single();
  if (!job) return NextResponse.json({ error: "Not found or not permitted" }, { status: 403 });

  // Hard consent gate, server-side. A forced status flip can't get past this.
  const { data: ok } = await supa.rpc("session_consent_ok", { p_session: job.session_id });
  if (!ok) return NextResponse.json({ error: "Consent is not cleared for this session." }, { status: 409 });

  const dgKey = process.env.DEEPGRAM_API_KEY;
  const secret = process.env.TRANSCRIBE_CALLBACK_SECRET;
  if (!dgKey || !secret) {
    return NextResponse.json({ error: "Server is missing transcription configuration." }, { status: 500 });
  }

  const admin = createAdminClient();

  // Consent enforcement (spec 6.1): exclude opted-out characters' audio before it
  // ever leaves our system. Opted-out = a per-session row with consented = false.
  const { data: optRows } = await admin
    .from("recording_consents")
    .select("character_id")
    .eq("session_id", job.session_id)
    .eq("consented", false);
  const optedOut = new Set(
    ((optRows as { character_id: string | null }[]) || [])
      .map((r) => r.character_id)
      .filter((id): id is string => !!id),
  );

  const { data: tracks } = await admin
    .from("audio_tracks")
    .select("id, storage_path, status, character_id")
    .eq("job_id", jobId);

  const todo = ((tracks as { id: string; storage_path: string | null; status: string; character_id: string | null }[]) || [])
    .filter((t) => t.storage_path && t.status !== "done")
    .filter((t) => !(t.character_id && optedOut.has(t.character_id)));
  if (todo.length === 0) return NextResponse.json({ error: "No tracks to transcribe." }, { status: 409 });

  const base = process.env.TRANSCRIBE_CALLBACK_BASE || req.nextUrl.origin;
  let submitted = 0;
  const failures: string[] = [];

  for (const t of todo as { id: string; storage_path: string }[]) {
    const { data: signed, error: signErr } = await admin.storage
      .from("session-audio")
      .createSignedUrl(t.storage_path, 7200);
    if (!signed?.signedUrl) {
      failures.push(`track ${t.id}: sign failed (${signErr?.message || "no url"})`);
      continue;
    }

    const cb = `${base}/api/transcribe/callback?track=${t.id}&k=${encodeURIComponent(secret)}`;
    const params = new URLSearchParams({
      model: "nova-3",
      smart_format: "true",
      punctuate: "true",
      utterances: "true",
      callback: cb,
    });

    const res = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
      method: "POST",
      headers: { Authorization: `Token ${dgKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: signed.signedUrl }),
    });

    if (res.ok) {
      submitted += 1;
      await admin.from("audio_tracks").update({ status: "transcribing" }).eq("id", t.id);
    } else {
      const body = await res.text().catch(() => "");
      failures.push(`track ${t.id}: deepgram ${res.status} ${body.slice(0, 200)}`);
    }
  }

  if (submitted === 0) {
    const detail = failures.join(" | ").slice(0, 900) || "unknown";
    await admin
      .from("capture_jobs")
      .update({ status: "error", error: `No tracks submitted: ${detail}` })
      .eq("id", jobId);
    return NextResponse.json({ error: "No tracks could be submitted to Deepgram.", detail: failures }, { status: 502 });
  }

  await admin.from("capture_jobs").update({ status: "transcribing", error: null }).eq("id", jobId);
  return NextResponse.json({ ok: true, submitted });
}
