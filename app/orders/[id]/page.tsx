import Link from "next/link";
import { notFound } from "next/navigation";
import { simulateDemoPayment } from "@/app/actions";
import { db } from "@/lib/db";
import { demoModeEnabled } from "@/lib/demo-config";
import { guestOrderTokenHash } from "@/lib/guest";
import { formatRupiah } from "@/lib/locale-format";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenHash = await guestOrderTokenHash();
  const [order] = await db()`SELECT id,status,total,expires_at,buyer_name,buyer_phone,buyer_email FROM orders WHERE id=${id} AND guest_token_hash=${tokenHash}`;
  if (!order) notFound();
  const [items, deliveries] = await Promise.all([
    db()`SELECT c.name,c.mode,i.quantity,i.unit_price FROM order_items i JOIN ticket_classes c ON c.id=i.class_id WHERE i.order_id=${id} ORDER BY c.mode,c.name`,
    db()`SELECT channel,status FROM delivery_jobs WHERE order_id=${id} ORDER BY channel`,
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
    {confirmed ? <div className="order-actions"><Link href="/claim-ticket">Claim Ticket</Link>{items.some((item) => item.mode === "LIVESTREAM") && <Link href="/livestream">Watch Livestream</Link>}<p>{deliveries.length ? deliveries.map((item) => `${item.channel}: ${item.status}`).join(" · ") : "Pengiriman sedang diantrikan."}</p></div> : demoModeEnabled() ? <div className="demo-payment-actions"><form action={simulateDemoPayment}><input type="hidden" name="orderId" value={id}/><button name="outcome" value="SUCCESS">Simulasikan pembayaran berhasil</button></form><form action={simulateDemoPayment}><input type="hidden" name="orderId" value={id}/><button name="outcome" value="FAILED">Simulasikan gagal</button></form></div> : <p className="checkout-warning">Pembayaran nyata tetap dinonaktifkan sampai Midtrans dan webhook produksi diverifikasi.</p>}
  </main>;
}
