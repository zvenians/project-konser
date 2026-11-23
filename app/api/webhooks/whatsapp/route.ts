import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (
    token &&
    url.searchParams.get("hub.mode") === "subscribe" &&
    url.searchParams.get("hub.verify_token") === token
  ) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", {
      headers: { "content-type": "text/plain" },
    });
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret)
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length > 1_000_000)
    return NextResponse.json({ error: "Too large" }, { status: 413 });
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const entries =
    (
      payload as {
        entry?: Array<{
          changes?: Array<{
            value?: { statuses?: Array<{ id?: string; status?: string }> };
          }>;
        }>;
      }
    )?.entry ?? [];
  for (const entry of entries)
    for (const change of entry.changes ?? [])
      for (const status of change.value?.statuses ?? []) {
        if (!status.id) continue;
        if (status.status === "delivered")
          await db()`UPDATE notification_outbox SET status='DELIVERED',delivered_at=coalesce(delivered_at,now()) WHERE provider_id=${status.id} AND status='SENT'`;
        if (status.status === "read")
          await db()`UPDATE notification_outbox SET status='READ',delivered_at=coalesce(delivered_at,now()),read_at=coalesce(read_at,now()) WHERE provider_id=${status.id} AND status IN ('SENT','DELIVERED')`;
        if (status.status === "failed")
          await db()`UPDATE notification_outbox SET status='FAILED',last_error='Provider reported delivery failure' WHERE provider_id=${status.id} AND status='SENT'`;
      }
  return NextResponse.json({ ok: true });
}
