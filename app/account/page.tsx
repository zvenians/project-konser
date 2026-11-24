import { redirect } from "next/navigation";
import { cancelOrder, logout, simulateDemoPayment, submitPayment } from "@/app/actions";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { settingValue } from "@/lib/settings";
import { getLocale } from "@/lib/i18n";
import { secondaryMessages, secondaryStatus } from "@/lib/secondary-messages";
import { CartClearer } from "@/components/cart-clearer";
import { demoModeEnabled } from "@/lib/demo-config";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ reserved?: string; demoPayment?: string }>;
}) {
  const params = await searchParams;
  const reserved = params.reserved === "1";
  const demo = demoModeEnabled();
  const locale = await getLocale();
  const en = locale === "en";
  const t = secondaryMessages(locale).account;
  const user = await currentUser();
  if (!user) redirect("/login");
  const [orders, tickets, settings, stream, notifications] = await Promise.all([
    db()`SELECT o.id,o.status,o.total,o.expires_at,o.created_at,o.demo_historical,p.outcome,p.receipt_label FROM orders o LEFT JOIN demo_payments p ON p.order_id=o.id WHERE o.user_id=${user.id} AND o.is_demo=${demo} ORDER BY o.created_at DESC LIMIT 50`,
    db()`SELECT t.id,c.name,t.barcode FROM ticket_inventory t JOIN ticket_allocations a ON a.ticket_id=t.id JOIN order_items i ON i.id=a.item_id JOIN orders o ON o.id=i.order_id JOIN ticket_classes c ON c.id=i.class_id WHERE o.user_id=${user.id} AND o.status='CONFIRMED' AND t.status='SOLD' AND t.is_demo=${demo}`,
    db()`SELECT value FROM site_settings WHERE key='payment_instructions'`,
    db()`SELECT count(*)::integer AS total FROM stream_entitlements WHERE user_id=${user.id} AND active=true`,
    db()`SELECT n.id,n.status,n.demo_message FROM notification_outbox n JOIN orders o ON o.id=n.order_id WHERE n.user_id=${user.id} AND o.is_demo=${demo} ORDER BY n.created_at DESC LIMIT 20`,
  ]);
  const payment = settingValue<{
    bank: string;
    account: string;
    holder: string;
  }>(settings[0]?.value);
  return (
    <main className="dashboard wrap section">
      {reserved && <CartClearer />}
      {demo && params.demoPayment && (
        <div className="demo-result" role="status">
          {params.demoPayment === "success"
            ? en
              ? "Simulated payment completed. Your demo tickets are ready."
              : "Pembayaran simulasi berhasil. Tiket demo Anda sudah siap."
            : en
              ? `Simulated payment ${params.demoPayment}. Reserved stock was released.`
              : `Pembayaran simulasi ${params.demoPayment}. Stok reservasi telah dilepas.`}
        </div>
      )}
      <div className="dashboard-head">
        <div>
          <p className="eyebrow">{t.accountLabel} / SYMPHONY OF FAITH</p>
          <h1>
            {t.welcome}
            <em>{user.name}</em>
          </h1>
          <p>{user.email}</p>
        </div>
        <form action={logout}>
          <button className="secondary-button" type="submit">
            {t.logOut}
          </button>
        </form>
      </div>
      <nav className="admin-nav" aria-label={t.accountNavigation}>
        <a href="#orders">{t.orders}</a>
        <a href="#tickets">{t.myTickets}</a>
        <Link href="/#tickets">{t.bookTickets}</Link>
        <a href="/livestream">Livestream</a>
        <Link href="/">{t.home} ↗</Link>
      </nav>
      <div className="metric-grid account-metrics">
        <div>
          <span>{t.totalOrders}</span>
          <strong>{orders.length}</strong>
        </div>
        <div>
          <span>{t.availablePDFs}</span>
          <strong>{tickets.length}</strong>
        </div>
        <div>
          <span>{t.livestreamAccess}</span>
          <strong>
            {stream[0]?.total ? t.accessActive : t.accessInactive}
          </strong>
        </div>
      </div>
      <section id="orders" className="dashboard-section">
        <p className="eyebrow">01 / ORDERS</p>
        <h2>{t.myOrders}</h2>
        {orders.length === 0 ? (
          <p className="empty">{t.noOrdersYetChooseATicket}</p>
        ) : (
          <div className="record-list">
            {orders.map((order) => (
              <article key={order.id} className="record">
                <div>
                  <p className="eyebrow">
                    {t.orderLabel} #{String(order.id).slice(0, 8)}
                  </p>
                  <h3>Rp{Number(order.total).toLocaleString("id-ID")}</h3>
                  <p className="status">
                    {secondaryStatus(locale, String(order.status))}
                  </p>
                  {demo && order.receipt_label && (
                    <p className="demo-receipt">Receipt: {order.receipt_label} · {order.outcome}</p>
                  )}
                  <small>
                    {t.created}{" "}
                    {new Date(order.created_at).toLocaleString(
                      en ? "en-US" : "id-ID",
                      {
                        timeZone: "Asia/Jakarta",
                      },
                    )}{" "}
                    WIB · {t.expires}{" "}
                    {new Date(order.expires_at).toLocaleString(
                      en ? "en-US" : "id-ID",
                      {
                        timeZone: "Asia/Jakarta",
                      },
                    )}{" "}
                    WIB
                  </small>
                  {order.status === "PENDING" && (
                    <form action={cancelOrder}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <button className="secondary-button" type="submit">
                        {t.cancelBooking}
                      </button>
                    </form>
                  )}
                </div>
                {order.status === "PENDING" && demo && (
                  <div className="payment-box demo-payment-box">
                    <strong>{en ? "Mock payment gateway" : "Gateway pembayaran simulasi"}</strong>
                    <p>{en ? "No real money will be collected." : "Tidak ada uang nyata yang ditagihkan."}</p>
                    <div className="demo-payment-actions">
                      {(["SUCCESS", "FAILED", "CANCELLED"] as const).map((outcome) => (
                        <form action={simulateDemoPayment} key={outcome}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="outcome" value={outcome} />
                          <button className={outcome === "SUCCESS" ? "" : "secondary-button"} type="submit">
                            {outcome === "SUCCESS"
                              ? en ? "Pay Successfully" : "Bayar berhasil"
                              : outcome === "FAILED"
                                ? en ? "Simulate Failed Payment" : "Simulasikan pembayaran gagal"
                                : en ? "Simulate Cancelled Payment" : "Simulasikan pembatalan"}
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                )}
                {order.status === "PENDING" && !demo && payment && (
                  <div className="payment-box">
                    <strong>
                      {t.transferTo} {payment.bank}
                    </strong>
                    <p>
                      {payment.account} · {t.accountHolder} {payment.holder}
                    </p>
                    <p>{t.afterTransferringSubmitYourTransactionReference}</p>
                    <form action={submitPayment}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <label>
                        {t.transferReference}
                        <input name="reference" required minLength={4} />
                      </label>
                      <button type="submit">{t.submitForVerification}</button>
                    </form>
                  </div>
                )}
                {order.status === "PAYMENT_REVIEW" && (
                  <p>{t.transferAwaitingStaffReviewTicketsAre}</p>
                )}
                {order.status === "EXPIRED" && (
                  <p>{t.bookingExpiredBookAgainIfTickets}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      {demo && notifications.length > 0 && (
        <section className="dashboard-section" id="notifications">
          <p className="eyebrow">WHATSAPP / PREVIEW</p>
          <h2>{en ? "Simulated message history" : "Riwayat pesan simulasi"}</h2>
          <div className="record-list">
            {notifications.map((notification) => {
              const message = notification.demo_message as { title?: string; body?: string; tickets?: Array<{ name: string; url: string }> } | null;
              return <article className="record whatsapp-preview" key={notification.id}><div><strong>{message?.title}</strong><p>{message?.body}</p>{message?.tickets?.map((ticket) => <a href={ticket.url} key={ticket.url}>{en ? "Download" : "Unduh"} {ticket.name} PDF</a>)}</div><span className="demo-receipt">{notification.status}</span></article>;
            })}
          </div>
        </section>
      )}
      <section id="tickets" className="dashboard-section">
        <p className="eyebrow">02 / COLLECTION</p>
        <h2>{t.myTickets}</h2>
        {tickets.length === 0 ? (
          <p className="empty">{t.yourTicketPDFWillAppearAfter}</p>
        ) : (
          <div className="ticket-collection">
            {tickets.map((ticket) => (
              <article className="ticket-item" key={ticket.id}>
                <span className="eyebrow">SYMPHONY OF FAITH / VENUE</span>
                <h3>{ticket.name}</h3>
                <p>{t.eventDate} · Tiara Convention Hall, Medan</p>
                {demo && (
                  <code className="demo-ticket-code" data-demo-ticket-code>
                    {ticket.barcode}
                  </code>
                )}
                <a href={`/api/tickets/${ticket.id}`}>
                  {demo ? (en ? "Download demo ticket PDF" : "Unduh tiket demo PDF") : t.downloadOriginalPDF} ↗
                </a>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="dashboard-section">
        <p className="eyebrow">03 / {t.ticketsLabel}</p>
        <h2>{t.lookingForTickets}</h2>
        <Link href="/#tickets">{t.exploreTickets} ↗</Link>
      </section>
    </main>
  );
}
