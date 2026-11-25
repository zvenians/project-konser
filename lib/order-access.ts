import "server-only";
import { db } from "@/lib/db";
import { guestOrderTokenHash } from "@/lib/guest";

export async function requireGuestOrder(orderId: string) {
  const tokenHash = await guestOrderTokenHash();
  if (!tokenHash) return null;
  const [order] = await db()`SELECT id,status,total,buyer_name,buyer_phone,buyer_email,payment_url
    FROM orders WHERE id=${orderId} AND guest_token_hash=${tokenHash}`;
  return order ?? null;
}

export async function guestOwnsTicket(orderId: string, ticketId: string) {
  const tokenHash = await guestOrderTokenHash();
  if (!tokenHash) return false;
  const [row] = await db()`SELECT 1 FROM orders o
    JOIN order_items i ON i.order_id=o.id
    JOIN ticket_allocations a ON a.item_id=i.id
    WHERE o.id=${orderId} AND o.guest_token_hash=${tokenHash} AND o.status='CONFIRMED'
      AND a.ticket_id=${ticketId}`;
  return Boolean(row);
}
