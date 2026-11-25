import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { demoModeEnabled } from "@/lib/demo-config";
import { createStreamingProvider } from "@/lib/providers";
import { normalizeStreamConfig, streamToken, streamTokenHash } from "@/lib/streaming";
import { settingValue } from "@/lib/settings";

export const dynamic = "force-dynamic";
const denied = (message: string, status = 403) => NextResponse.json({ error: message }, { status });

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return denied("AUTH_REQUIRED", 401);
  const demo = demoModeEnabled();
  const takeover = request.nextUrl.searchParams.get("takeover") === "1";
  const supplied = request.nextUrl.searchParams.get("session") || "";
  const [setting] = await db()`SELECT value FROM site_settings WHERE key='stream'`;
  const config = normalizeStreamConfig(settingValue(setting?.value));
  const [entitlement] = await db()`SELECT s.id,s.event_id FROM stream_entitlements s JOIN orders o ON o.id=s.order_id JOIN order_items i ON i.order_id=o.id JOIN ticket_classes c ON c.id=i.class_id WHERE s.user_id=${user.id} AND s.active=true AND s.revoked_at IS NULL AND o.user_id=${user.id} AND o.is_demo=${demo} AND o.status='CONFIRMED' AND c.mode='LIVESTREAM' AND c.event_id=s.event_id LIMIT 1`;
  if (!entitlement) return denied("LIVESTREAM_ENTITLEMENT_REQUIRED");

  let token = supplied;
  let sessionId: string | undefined;
  await db().begin(async (tx) => {
    await tx`UPDATE stream_viewer_sessions SET active=false,ended_at=now() WHERE active=true AND last_heartbeat<now()-interval '45 seconds'`;
    if (token) {
      const [existing] = await tx`SELECT id FROM stream_viewer_sessions WHERE token_hash=${streamTokenHash(token)} AND user_id=${user.id} AND event_id=${entitlement.event_id} AND active=true FOR UPDATE`;
      if (existing) { sessionId = existing.id; await tx`UPDATE stream_viewer_sessions SET last_heartbeat=now() WHERE id=${existing.id}`; return; }
      token = "";
    }
    const [count] = await tx`SELECT count(*)::integer AS total FROM stream_viewer_sessions WHERE user_id=${user.id} AND event_id=${entitlement.event_id} AND active=true AND last_heartbeat>now()-interval '45 seconds'`;
    if (count.total >= config.sessionLimit && !takeover) return;
    if (takeover) {
      await tx`UPDATE stream_viewer_sessions SET active=false,ended_at=now() WHERE user_id=${user.id} AND event_id=${entitlement.event_id} AND active=true`;
      await tx`INSERT INTO audit_logs(actor_id,action,resource_id,details) VALUES (${user.id},'STREAM_SESSION_TAKEOVER',${entitlement.event_id},'{}')`;
    }
    token = streamToken();
    const [created] = await tx`INSERT INTO stream_viewer_sessions(entitlement_id,user_id,event_id,token_hash) VALUES (${entitlement.id},${user.id},${entitlement.event_id},${streamTokenHash(token)}) RETURNING id`;
    sessionId = created.id;
  });
  if (!sessionId) return denied("SESSION_LIMIT_REACHED", 409);
  let playback = null;
  if (config.viewerAccess && ["LIVE", "INTERRUPTED"].includes(config.state)) {
    try { playback = await createStreamingProvider(config.provider).createViewerAccess({ videoId: config.videoId, expiresInSeconds: 300 }); }
    catch (error) { return denied(error instanceof Error ? error.message : "PLAYBACK_UNAVAILABLE", 503); }
  }
  return NextResponse.json({ session: token, config, playback, youtubeNotice: config.provider === "youtube" ? "YouTube unlisted links remain shareable; access control is enforced by this application, not by YouTube." : undefined });
}

export async function POST(request: NextRequest) {
  const user = await currentUser(); if (!user) return denied("AUTH_REQUIRED", 401);
  const body = await request.json().catch(() => ({})) as { session?: string };
  if (!body.session) return denied("SESSION_REQUIRED", 400);
  const [updated] = await db()`UPDATE stream_viewer_sessions SET last_heartbeat=now() WHERE token_hash=${streamTokenHash(body.session)} AND user_id=${user.id} AND active=true RETURNING id`;
  if (!updated) return denied("SESSION_ENDED", 409);
  return NextResponse.json({ ok: true });
}
