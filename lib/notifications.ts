import "server-only";
import { db } from "@/lib/db";

export async function processNotifications(limit = 20) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_TEMPLATE_PAYMENT_CONFIRMED;
  const version = process.env.WHATSAPP_API_VERSION ?? "v27.0";
  if (!token || !phoneId || !template)
    return { processed: 0, configured: false };
  if (!/^v\d+\.\d+$/.test(version) || !/^\d+$/.test(phoneId))
    throw new Error("Konfigurasi WhatsApp tidak valid.");
  const sql = db();
  await sql`UPDATE notification_outbox SET status='QUEUED',next_attempt_at=now() WHERE status='SENDING' AND locked_at<now()-interval '10 minutes'`;
  let processed = 0;
  for (let index = 0; index < limit; index++) {
    const row = await sql.begin(async (tx) => {
      const [job] =
        await tx`SELECT n.id,n.kind,u.phone,u.whatsapp_consent_at FROM notification_outbox n JOIN users u ON u.id=n.user_id WHERE n.status='QUEUED' AND n.next_attempt_at<=now() ORDER BY n.next_attempt_at FOR UPDATE OF n SKIP LOCKED LIMIT 1`;
      if (!job) return null;
      await tx`UPDATE notification_outbox SET status='SENDING',locked_at=now(),attempts=attempts+1 WHERE id=${job.id}`;
      return job;
    });
    if (!row) break;
    processed++;
    if (!row.phone || !row.whatsapp_consent_at) {
      await sql`UPDATE notification_outbox SET status='DISABLED',last_error='Nomor atau persetujuan WhatsApp tidak tersedia' WHERE id=${row.id}`;
      continue;
    }
    try {
      const response = await fetch(
        `https://graph.facebook.com/${version}/${phoneId}/messages`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: row.phone.slice(1),
            type: "template",
            template: {
              name: template,
              language: {
                code: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "id",
              },
            },
          }),
          signal: AbortSignal.timeout(12000),
        },
      );
      const payload = await response.json();
      if (!response.ok || !payload.messages?.[0]?.id)
        throw new Error(`Meta API ${response.status}`);
      await sql`UPDATE notification_outbox SET status='SENT',provider_id=${payload.messages[0].id},last_error=NULL WHERE id=${row.id}`;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Pengiriman gagal";
      await sql`UPDATE notification_outbox SET status=CASE WHEN attempts>=5 THEN 'FAILED' ELSE 'QUEUED' END,next_attempt_at=now()+make_interval(mins => least(60,power(2,attempts)::integer)),last_error=${message.slice(0, 200)} WHERE id=${row.id}`;
    }
  }
  return { processed, configured: true };
}
