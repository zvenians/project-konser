import "server-only";
import { db } from "@/lib/db";

export async function expireReservations() {
  await db().begin(async (tx) => {
    await tx`DELETE FROM sessions WHERE expires_at<now()`;
    const expired =
      await tx`UPDATE orders SET status='EXPIRED' WHERE status IN ('PENDING','PAYMENT_REVIEW') AND expires_at<now() RETURNING id`;
    for (const order of expired) {
      await tx`UPDATE ticket_inventory SET status='AVAILABLE' WHERE id IN (SELECT a.ticket_id FROM ticket_allocations a JOIN order_items i ON i.id=a.item_id WHERE i.order_id=${order.id})`;
      await tx`DELETE FROM ticket_allocations WHERE item_id IN (SELECT id FROM order_items WHERE order_id=${order.id})`;
      await tx`UPDATE stream_entitlements SET active=false WHERE order_id=${order.id}`;
      await tx`INSERT INTO order_status_history(order_id,to_status) VALUES (${order.id},'EXPIRED')`;
    }
    await tx`UPDATE donations SET status='EXPIRED' WHERE status='PENDING' AND expires_at<now()`;
  });
}
