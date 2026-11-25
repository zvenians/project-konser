import "server-only";
import { newGuestToken, tokenDigest } from "@/lib/guest";
import { db } from "@/lib/db";

export async function createTicketDownloadToken(orderId: string, ticketId?: string, minutes = 30) {
  const token = newGuestToken();
  await db()`INSERT INTO ticket_download_tokens(token_hash,order_id,ticket_id,expires_at)
    VALUES (${tokenDigest(token)},${orderId},${ticketId ?? null},now()+(${minutes} || ' minutes')::interval)`;
  return token;
}

export async function verifyTicketDownloadToken(token: string, orderId: string, ticketId?: string) {
  if (!token) return false;
  const [row] = await db()`SELECT 1 FROM ticket_download_tokens WHERE token_hash=${tokenDigest(token)}
    AND order_id=${orderId} AND (ticket_id IS NULL OR ticket_id=${ticketId ?? null})
    AND used_at IS NULL AND expires_at>now()`;
  return Boolean(row);
}
