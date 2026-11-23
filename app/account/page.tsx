import { redirect } from "next/navigation";
import { cancelOrder, logout, submitPayment } from "@/app/actions";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BookingForm } from "@/components/booking-form";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { settingValue } from "@/lib/settings";

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const [orders, classes, tickets, settings, stream] = await Promise.all([
    db()`SELECT id,status,total,expires_at,created_at FROM orders WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 50`,
    db()`SELECT c.id,c.name,c.mode,c.price,CASE WHEN c.mode='VENUE' THEN count(t.id) FILTER(WHERE t.status='AVAILABLE') ELSE 10 END::integer AS available FROM ticket_classes c JOIN events e ON e.id=c.event_id LEFT JOIN ticket_inventory t ON t.class_id=c.id WHERE c.sale_enabled AND (c.mode='VENUE' OR e.streaming_ready) GROUP BY c.id ORDER BY c.price DESC`,
    db()`SELECT t.id,c.name FROM ticket_inventory t JOIN ticket_allocations a ON a.ticket_id=t.id JOIN order_items i ON i.id=a.item_id JOIN orders o ON o.id=i.order_id JOIN ticket_classes c ON c.id=i.class_id WHERE o.user_id=${user.id} AND o.status='CONFIRMED' AND t.status='SOLD'`,
    db()`SELECT value FROM site_settings WHERE key='payment_instructions'`,
    db()`SELECT count(*)::integer AS total FROM stream_entitlements WHERE user_id=${user.id} AND active=true`,
  ]);
  const payment = settingValue<{
    bank: string;
    account: string;
    holder: string;
  }>(settings[0]?.value);
  return (
    <main className="dashboard wrap section">
      <div className="dashboard-head">
        <div>
          <p className="eyebrow">AKUN / SYMPHONY OF FAITH</p>
          <h1>
            Selamat datang, <em>{user.name}</em>
          </h1>
          <p>{user.email}</p>
        </div>
        <form action={logout}>
          <button className="secondary-button" type="submit">
            Keluar
          </button>
        </form>
      </div>
      <nav className="admin-nav" aria-label="Navigasi akun">
        <a href="#orders">Pesanan</a>
        <a href="#tickets">Tiket saya</a>
        <a href="#booking">Pesan tiket</a>
        <a href="/livestream">Livestream</a>
        <Link href="/">Beranda ↗</Link>
      </nav>
      <div className="metric-grid account-metrics">
        <div>
          <span>Total pesanan</span>
          <strong>{orders.length}</strong>
        </div>
        <div>
          <span>PDF tersedia</span>
          <strong>{tickets.length}</strong>
        </div>
        <div>
          <span>Akses livestream</span>
          <strong>{stream[0]?.total ? "Aktif" : "Belum aktif"}</strong>
        </div>
      </div>
      <section id="orders" className="dashboard-section">
        <p className="eyebrow">01 / ORDERS</p>
        <h2>Pesanan saya</h2>
        {orders.length === 0 ? (
          <p className="empty">
            Belum ada pesanan. Pilih kelas tiket saat penjualan dibuka.
          </p>
        ) : (
          <div className="record-list">
            {orders.map((order) => (
              <article key={order.id} className="record">
                <div>
                  <p className="eyebrow">
                    PESANAN #{String(order.id).slice(0, 8)}
                  </p>
                  <h3>Rp{Number(order.total).toLocaleString("id-ID")}</h3>
                  <p className="status">{order.status}</p>
                  <small>
                    Dibuat{" "}
                    {new Date(order.created_at).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}{" "}
                    WIB · Batas{" "}
                    {new Date(order.expires_at).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}{" "}
                    WIB
                  </small>
                  {order.status === "PENDING" && (
                    <form action={cancelOrder}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <button className="secondary-button" type="submit">
                        Batalkan reservasi
                      </button>
                    </form>
                  )}
                </div>
                {order.status === "PENDING" && payment && (
                  <div className="payment-box">
                    <strong>Transfer ke {payment.bank}</strong>
                    <p>
                      {payment.account} · a.n. {payment.holder}
                    </p>
                    <p>
                      Setelah transfer, kirim referensi transaksi. Verifikasi
                      dilakukan petugas setelah dana cocok dengan mutasi
                      rekening.
                    </p>
                    <form action={submitPayment}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <label>
                        Referensi transfer
                        <input name="reference" required minLength={4} />
                      </label>
                      <button type="submit">Ajukan verifikasi</button>
                    </form>
                  </div>
                )}
                {order.status === "PAYMENT_REVIEW" && (
                  <p>
                    Transfer menunggu pemeriksaan petugas. Tiket belum aktif.
                  </p>
                )}
                {order.status === "EXPIRED" && (
                  <p>
                    Reservasi berakhir. Silakan pesan kembali jika stok
                    tersedia.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <section id="tickets" className="dashboard-section">
        <p className="eyebrow">02 / COLLECTION</p>
        <h2>Tiket saya</h2>
        {tickets.length === 0 ? (
          <p className="empty">
            PDF tiket asli muncul setelah pembayaran diverifikasi.
          </p>
        ) : (
          <div className="ticket-collection">
            {tickets.map((ticket) => (
              <article className="ticket-item" key={ticket.id}>
                <span className="eyebrow">SYMPHONY OF FAITH / VENUE</span>
                <h3>{ticket.name}</h3>
                <p>7 Februari 2027 · Tiara Convention Hall, Medan</p>
                <a href={`/api/tickets/${ticket.id}`}>Unduh PDF asli ↗</a>
              </article>
            ))}
          </div>
        )}
      </section>
      <section id="booking" className="dashboard-section">
        <p className="eyebrow">03 / RESERVATION</p>
        <h2>Pilih pengalamanmu</h2>
        {payment ? (
          <BookingForm
            idempotencyKey={randomUUID()}
            classes={classes
              .filter((row) => Number(row.available) > 0)
              .map((row) => ({
                id: String(row.id),
                name: String(row.name),
                mode: String(row.mode),
                price: Number(row.price),
                available: Number(row.available),
              }))}
          />
        ) : (
          <p className="empty">
            Pemesanan dibuka setelah instruksi pembayaran resmi dikonfigurasi.
          </p>
        )}
      </section>
    </main>
  );
}
