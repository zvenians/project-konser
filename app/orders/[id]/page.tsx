import Link from "next/link";
import { notFound } from "next/navigation";
import { simulateDemoPayment } from "@/app/actions";
import { db } from "@/lib/db";
import { demoModeEnabled } from "@/lib/demo-config";
import { guestOrderTokenHash } from "@/lib/guest";
import { formatRupiah } from "@/lib/locale-format";
import { PaymentSuccess } from "@/components/payment-success";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenHash = await guestOrderTokenHash();
  const [order] = await db()`SELECT id,status,total,expires_at,buyer_name,buyer_phone,buyer_email,payment_url FROM orders WHERE id=${id} AND guest_token_hash=${tokenHash}`;
  if (!order) notFound();
  const [items, deliveries, tickets] = await Promise.all([
    db()`SELECT c.name,c.mode,i.quantity,i.unit_price FROM order_items i JOIN ticket_classes c ON c.id=i.class_id WHERE i.order_id=${id} ORDER BY c.mode,c.name`,
    db()`SELECT channel,status FROM delivery_jobs WHERE order_id=${id} ORDER BY channel`,
    db()`SELECT t.id,c.name FROM ticket_inventory t JOIN ticket_allocations a ON a.ticket_id=t.id JOIN order_items i ON i.id=a.item_id JOIN ticket_classes c ON c.id=i.class_id WHERE i.order_id=${id} AND t.status='SOLD' ORDER BY c.name,t.id`,
  ]);
  const confirmed = order.status === "CONFIRMED";
  return <main className="order-confirmation event-container">
    <Link className="back-link" href="/">← Beranda</Link>
    <p className="eyebrow">ORDER {String(order.id).slice(0, 8).toUpperCase()}</p>
    <h1>{confirmed ? "Pembayaran terverifikasi" : "Selesaikan pembayaran"}</h1>
    <p>{confirmed ? "Tiket dan akses digital telah diterbitkan. Status pengiriman ditampilkan apa adanya di bawah." : `Reservasi berlaku sampai ${new Date(order.expires_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB.`}</p>
    <section className="order-sheet">
      <div><span>Pembeli</span><strong>{order.buyer_name}</strong><small>{String(order.buyer_phone).replace(/(\+62\d{3})\d+(\d{3})/, "$1••••$2")}{order.buyer_email ? ` · ${String(order.buyer_email).replace(/(^.).*(@.*$)/, "$1•••$2")}` : ""}</small></div>
      {items.map((item) => <div key={`${item.mode}-${item.name}`}><span>{item.mode}</span><strong>{item.quantity} × {item.name}</strong><small>{formatRupiah(Number(item.unit_price) * Number(item.quantity))}</small></div>)}
      <div className="order-total"><span>Total</span><strong>{formatRupiah(Number(order.total))}</strong></div>
    </section>
    {confirmed && <PaymentSuccess buyer={order.buyer_name} reference={String(order.id).slice(0,8).toUpperCase()} total={formatRupiah(Number(order.total))} tickets={tickets.map((ticket) => ({ id: String(ticket.id), name: String(ticket.name), url: `/api/tickets/${ticket.id}` }))} deliveries={deliveries.map((item) => ({ channel: String(item.channel), status: String(item.status) }))} livestream={items.some((item) => item.mode === "LIVESTREAM")}/>}
    {confirmed ? <div className="order-actions"><Link href="/claim-ticket">Claim Ticket</Link>{tickets.map((ticket) => <a key={ticket.id} href={`/api/tickets/${ticket.id}`}>Unduh {ticket.name}</a>)}{items.some((item) => item.mode === "LIVESTREAM") && <Link href="/livestream">Watch Livestream</Link>}<p>{deliveries.length ? deliveries.map((item) => `${item.channel}: ${item.status}`).join(" · ") : "Pengiriman sedang diantrikan."}</p></div> : order.payment_url ? <a className="primary-button" href={order.payment_url}>Lanjutkan pembayaran Midtrans</a> : demoModeEnabled() ? <div className="demo-payment-actions"><form action={simulateDemoPayment}><input type="hidden" name="orderId" value={id}/><button name="outcome" value="SUCCESS">Simulasikan pembayaran berhasil</button></form><form action={simulateDemoPayment}><input type="hidden" name="orderId" value={id}/><button name="outcome" value="FAILED">Simulasikan gagal</button></form></div> : <p className="checkout-warning">Pembayaran nyata tetap dinonaktifkan sampai Midtrans dan webhook produksi diverifikasi.</p>}
  </main>;
}
