import "server-only";
import { get } from "@vercel/blob";
import { db } from "@/lib/db";
import { createTicketDownloadToken } from "@/lib/download-tokens";
import { productionProviders, realTransactionsEnabled } from "@/lib/providers";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));

export async function processDeliveryJobs(limit = 20) {
  if (!realTransactionsEnabled()) return { processed: 0, disabled: true };
  const jobs = await db().begin(async tx => tx`WITH picked AS (
      SELECT id FROM delivery_jobs WHERE status IN ('PENDING','FAILED') AND next_attempt_at<=now() AND attempts<5 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT ${limit}
    ) UPDATE delivery_jobs j SET status='PROCESSING',attempts=attempts+1,updated_at=now() FROM picked WHERE j.id=picked.id RETURNING j.*`);
  let processed = 0;
  for (const job of jobs) {
    try {
      const [order] = await db()`SELECT id,buyer_name,buyer_email,buyer_phone FROM orders WHERE id=${job.order_id} AND status='CONFIRMED'`;
      if (!order) throw new Error("Pesanan tidak lagi memenuhi syarat pengiriman.");
      const tickets = await db()`SELECT t.id,t.file_key,coalesce(t.original_name,c.name || '-' || t.id || '.pdf') AS name FROM ticket_inventory t JOIN ticket_allocations a ON a.ticket_id=t.id JOIN order_items i ON i.id=a.item_id JOIN ticket_classes c ON c.id=i.class_id WHERE i.order_id=${order.id} AND t.status='SOLD'`;
      const origin = process.env.NEXT_PUBLIC_APP_URL || "https://symphonyoffaith.vercel.app";
      const links: string[] = [];
      for (const ticket of tickets) links.push(`${origin}/api/tickets/${ticket.id}?token=${await createTicketDownloadToken(order.id,ticket.id,1440)}`);
      const payload = (job.payload || {}) as { code?: string };
      const otp = job.kind.endsWith("_OTP") ? payload.code : undefined;
      const livestream = await db()`SELECT 1 FROM stream_entitlements WHERE order_id=${order.id} AND active=true LIMIT 1`;
      if (job.channel === "WHATSAPP") {
        const variables = otp ? [otp, "5"] : [String(order.id).slice(0,8).toUpperCase(), links.join(" ") || `${origin}/orders/${order.id}`, livestream.length ? `${origin}/livestream` : "-"];
        const result = await productionProviders.notification.sendTemplate({ recipient: job.recipient, template: otp ? "symphony_otp" : "symphony_order_delivery", variables });
        if (!otp) for (let index=0; index<links.length; index++) await productionProviders.notification.sendDocument({ recipient: job.recipient, url: links[index], filename: tickets[index].name, caption: `Tiket Symphony of Faith ${index+1}` });
        await db()`UPDATE delivery_jobs SET status='DELIVERED',provider_reference=${result.reference},last_error=NULL,updated_at=now() WHERE id=${job.id}`;
      } else {
        const attachments = [] as Array<{name:string;content:string}>;
        for (const ticket of tickets) { const blob = await get(ticket.file_key,{access:"private"}); if (blob?.stream) { const bytes=Buffer.from(await new Response(blob.stream).arrayBuffer()); attachments.push({name:ticket.name,content:bytes.toString("base64")}); } }
        const subject = otp ? "Kode akses Symphony of Faith" : "Tiket Symphony of Faith Anda";
        const body = otp ? `<p>Kode verifikasi Anda: <strong>${escapeHtml(otp)}</strong>. Berlaku 5 menit.</p>` : `<p>Halo ${escapeHtml(order.buyer_name || "")}, pembayaran Anda telah terverifikasi.</p><p>${links.map((link,index)=>`<a href="${link}">Unduh tiket ${index+1}</a>`).join("<br>")}</p>${livestream.length?`<p><a href="${origin}/livestream">Buka viewing room</a></p>`:""}`;
        const result = await productionProviders.email.send({ recipient: job.recipient, subject, html: body, attachments });
        await db()`UPDATE delivery_jobs SET status='DELIVERED',provider_reference=${result.reference},last_error=NULL,updated_at=now() WHERE id=${job.id}`;
      }
      processed++;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0,500) : "Delivery failed";
      await db()`UPDATE delivery_jobs SET status='FAILED',last_error=${message},next_attempt_at=now()+(least(attempts,5) * interval '5 minutes'),updated_at=now() WHERE id=${job.id}`;
    }
  }
  return { processed, disabled: false };
}
