import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postRecapToDiscord } from "@/lib/discord/post";

export const maxDuration = 30;

// Posts a session's saved recap to the campaign's linked Discord channel.
// Discord-only: no email, so it does not depend on RESEND_API_KEY.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = body?.sessionId;
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    // RLS ensures the user can only read a session they own.
    const { data: session, error: sErr } = await supabase
      .from("sessions")
      .select("id, campaign_id, session_number, recap")
      .eq("id", sessionId)
      .single();
    if (sErr || !session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }
    if (!session.recap || !session.recap.trim()) {
      return NextResponse.json({ error: "Save a recap before posting." }, { status: 422 });
    }

    const { data: campaign } = await supabase
      .from("campaigns").select("name, discord_channel_id").eq("id", session.campaign_id).single();
    const campaignName = campaign?.name || "Your campaign";
    const discordChannelId = campaign?.discord_channel_id || null;

    if (!discordChannelId) {
      return NextResponse.json(
        { error: "No linked Discord channel. Run /setup in the channel you want recaps posted to." },
        { status: 400 },
      );
    }

    const posted = await postRecapToDiscord(
      discordChannelId, campaignName, session.session_number, session.recap,
    );
    if (!posted) {
      return NextResponse.json({ error: "Could not post to Discord. Check the bot is in the server and the channel is correct." }, { status: 502 });
    }

    return NextResponse.json({ discordPosted: true });
  } catch {
    return NextResponse.json({ error: "Could not post recap to Discord." }, { status: 500 });
  }
}
