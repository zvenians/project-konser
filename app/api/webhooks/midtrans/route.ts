import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { realTransactionsEnabled } from "@/lib/providers";

const payloadSchema = z.object({
  order_id: z.uuid(), transaction_id: z.string().min(1), transaction_status: z.string(),
  status_code: z.string(), gross_amount: z.string(), signature_key: z.string(), fraud_status: z.string().optional(),
});
const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(request: Request) {
  if (!realTransactionsEnabled()) return NextResponse.json({ error: "disabled" }, { status: 503 });
  try {
    const body = payloadSchema.parse(await request.json());
    const serverKey = process.env.MIDTRANS_SERVER_KEY!;
    const expected = createHash("sha512").update(`${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`).digest("hex");
    if (!safeEqual(expected, body.signature_key)) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    const base = process.env.MIDTRANS_IS_PRODUCTION === "true" ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
    const response = await fetch(`${base}/v2/${encodeURIComponent(body.order_id)}/status`, { headers: { Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return NextResponse.json({ error: "verification failed" }, { status: 502 });
    const verified = payloadSchema.passthrough().parse(await response.json());
    if (!safeEqual(verified.signature_key, body.signature_key) || verified.transaction_status !== body.transaction_status)
      return NextResponse.json({ error: "verification mismatch" }, { status: 409 });
    const amount = Math.round(Number(verified.gross_amount));
    const payloadHash = createHash("sha256").update(JSON.stringify(verified)).digest("hex");
    await db().begin(async (tx) => {
      const [order] = await tx`SELECT id,status,total,buyer_phone,buyer_email FROM orders WHERE id=${verified.order_id} AND is_demo=false FOR UPDATE`;
      if (!order || Number(order.total) !== amount) throw new Error("amount mismatch");
      const inserted = await tx`INSERT INTO payment_events(provider,provider_event_id,order_id,amount,status,payload_hash) VALUES ('MIDTRANS',${verified.transaction_id},${order.id},${amount},${verified.transaction_status},${payloadHash}) ON CONFLICT DO NOTHING RETURNING id`;
      if (!inserted.length) return;
      const paid = ["settlement","capture"].includes(verified.transaction_status) && verified.fraud_status !== "deny";
      const terminal = ["deny","cancel","expire","refund","partial_refund"].includes(verified.transaction_status);
      if (paid && ["PENDING","PAYMENT_REVIEW"].includes(order.status)) {
        await tx`UPDATE orders SET status='CONFIRMED',paid_at=now(),payment_reference=${verified.transaction_id} WHERE id=${order.id}`;
        await tx`UPDATE ticket_inventory SET status='SOLD' WHERE id IN (SELECT a.ticket_id FROM ticket_allocations a JOIN order_items i ON i.id=a.item_id WHERE i.order_id=${order.id})`;
        await tx`UPDATE stream_entitlements SET active=true,revoked_at=NULL WHERE order_id=${order.id}`;
        if (order.buyer_phone) await tx`INSERT INTO delivery_jobs(order_id,channel,kind,recipient) VALUES (${order.id},'WHATSAPP','ORDER_FULFILLMENT',${order.buyer_phone}) ON CONFLICT DO NOTHING`;
        if (order.buyer_email) await tx`INSERT INTO delivery_jobs(order_id,channel,kind,recipient) VALUES (${order.id},'EMAIL','ORDER_FULFILLMENT',${order.buyer_email}) ON CONFLICT DO NOTHING`;
      } else if (terminal && order.status !== "CONFIRMED") {
        const status = verified.transaction_status === "expire" ? "EXPIRED" : verified.transaction_status.includes("refund") ? "REFUNDED" : "FAILED";
        await tx`UPDATE orders SET status=${status} WHERE id=${order.id}`;
        await tx`UPDATE ticket_inventory SET status='AVAILABLE' WHERE id IN (SELECT a.ticket_id FROM ticket_allocations a JOIN order_items i ON i.id=a.item_id WHERE i.order_id=${order.id})`;
        await tx`DELETE FROM ticket_allocations WHERE item_id IN (SELECT id FROM order_items WHERE order_id=${order.id})`;
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(JSON.stringify({ event: "midtrans_webhook_failed", message: error instanceof Error ? error.message : "unknown" }));
    return NextResponse.json({ error: "webhook rejected" }, { status: 400 });
  }
}
