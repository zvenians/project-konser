import { redirect } from "next/navigation";
import {
  configurePayment,
  configureStream,
  confirmOrder,
  releaseExpired,
  setTicketSale,
  setUserRole,
  verifyDonation,
  verifyTicket,
  setDemoStreamState,
} from "@/app/actions";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { settingValue } from "@/lib/settings";
import { BatchImport } from "@/components/batch-import";
import { getLocale } from "@/lib/i18n";
import { secondaryMessages, secondaryStatus } from "@/lib/secondary-messages";
import { demoModeEnabled } from "@/lib/demo-config";
import { DemoCheckIn } from "@/components/demo-check-in";
import { DemoReset } from "@/components/demo-reset";
import { hasCapability } from "@/lib/permissions";

const money = (value: number | string) =>
  `Rp${Number(value).toLocaleString("id-ID")}`;
const messagePreview = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  return value as { title?: string; body?: string; tickets?: Array<{ name: string; url: string }> };
};
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; from?: string; to?: string; demoReset?: string }>;
}) {
  const locale = await getLocale();
  const demo = demoModeEnabled();
  const en = locale === "en";
  const t = secondaryMessages(locale).admin;
  const user = await currentUser();
  if (!user || !["ADMIN", "FINANCE", "CHECK_IN", "STREAM_OPERATOR"].includes(user.role)) redirect("/login");
  const canOperateInventory = hasCapability(user.role, "inventory");
  const canViewFinance = hasCapability(user.role, "finance");
  const canCheckIn = hasCapability(user.role, "checkin");
  const canOperateStream = hasCapability(user.role, "stream");
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? "") ? params.from! : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.to ?? "") ? params.to! : "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const offset = (page - 1) * 25;
  const status = [
    "PENDING",
    "PAYMENT_REVIEW",
    "CONFIRMED",
    "CANCELLED",
    "EXPIRED",
    "FAILED",
  ].includes(params.status ?? "")
    ? params.status!
    : "ALL";
  const [
    stock,
    orders,
    donations,
    review,
    donationQueue,
    settings,
    notifications,
    streamSettings,
    summary,
    revenue,
    checkins,
    batches,
    users,
    donationHistory,
  ] = await Promise.all([
    canOperateInventory ? db()`SELECT c.id,c.name,c.mode,c.capacity,c.sales_target,c.purchase_limit,c.sale_enabled,
      count(t.id) FILTER(WHERE t.status='AVAILABLE' AND t.is_demo=${demo}) AS available,
      count(t.id) FILTER(WHERE t.status='RESERVED' AND t.is_demo=${demo}) AS reserved,
      count(t.id) FILTER(WHERE t.status='SOLD' AND t.is_demo=${demo}) AS sold,
      coalesce((SELECT sum(i.quantity)::integer FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.class_id=c.id AND o.is_demo=${demo} AND o.status IN ('PENDING','PAYMENT_REVIEW')),0) AS stream_reserved,
      coalesce((SELECT sum(i.quantity)::integer FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.class_id=c.id AND o.is_demo=${demo} AND o.status='CONFIRMED'),0) AS stream_sold
      FROM ticket_classes c LEFT JOIN ticket_inventory t ON t.class_id=c.id GROUP BY c.id ORDER BY c.mode,c.price DESC` : Promise.resolve([]),
    canViewFinance ? db()`SELECT o.id,o.status,o.total,o.expires_at,coalesce(u.name,o.buyer_name) AS name,coalesce(u.email,o.buyer_email) AS email,p.transfer_reference FROM orders o LEFT JOIN users u ON u.id=o.user_id LEFT JOIN payment_claims p ON p.order_id=o.id WHERE o.is_demo=${demo} AND (${q}='' OR coalesce(u.name,o.buyer_name,'') ILIKE ${`%${q}%`} OR coalesce(u.email,o.buyer_email,'') ILIKE ${`%${q}%`} OR o.id::text ILIKE ${`%${q}%`}) AND (${status}='ALL' OR o.status=${status}) AND (NULLIF(${from},'')::date IS NULL OR o.created_at>=NULLIF(${from},'')::date) AND (NULLIF(${to},'')::date IS NULL OR o.created_at<(NULLIF(${to},'')::date+1)) ORDER BY o.created_at DESC LIMIT 25 OFFSET ${offset}` : Promise.resolve([]),
    canViewFinance ? db()`SELECT status,count(*) AS count,coalesce(sum(amount),0) AS total FROM donations WHERE is_demo=${demo} GROUP BY status` : Promise.resolve([]),
    canOperateInventory ? db()`SELECT t.id,c.name,t.barcode,t.original_name FROM ticket_inventory t JOIN ticket_classes c ON c.id=t.class_id WHERE t.status='NEEDS_REVIEW' AND t.is_demo=${demo} ORDER BY t.id LIMIT 50` : Promise.resolve([]),
    canViewFinance ? db()`SELECT id,donor_name,amount,payment_reference FROM donations WHERE status='PENDING' AND expires_at>now() AND is_demo=${demo} ORDER BY created_at LIMIT 50` : Promise.resolve([]),
    user.role === "ADMIN" ? db()`SELECT value FROM site_settings WHERE key='payment_instructions'` : Promise.resolve([]),
    canViewFinance ? db()`SELECT n.id,n.kind,n.status,n.demo_message,n.created_at,u.name FROM notification_outbox n JOIN orders o ON o.id=n.order_id JOIN users u ON u.id=n.user_id WHERE o.is_demo=${demo} ORDER BY n.created_at DESC LIMIT 50` : Promise.resolve([]),
    canOperateStream ? db()`SELECT value FROM site_settings WHERE key='stream'` : Promise.resolve([]),
    canViewFinance ? db()`SELECT count(*) FILTER (WHERE status='CONFIRMED')::integer AS confirmed,count(*) FILTER(WHERE status='PAYMENT_REVIEW')::integer AS reviewing FROM orders WHERE is_demo=${demo}` : Promise.resolve([]),
    canViewFinance ? db()`SELECT c.mode,count(DISTINCT o.id)::integer AS orders,coalesce(sum(i.quantity),0)::integer AS quantity,coalesce(sum(i.quantity*i.unit_price),0) AS revenue FROM order_items i JOIN orders o ON o.id=i.order_id JOIN ticket_classes c ON c.id=i.class_id WHERE o.is_demo=${demo} AND o.status='CONFIRMED' GROUP BY c.mode` : Promise.resolve([]),
    canCheckIn ? db()`SELECT count(*)::integer AS total FROM ticket_checkins c JOIN ticket_inventory t ON t.id=c.ticket_id WHERE t.is_demo=${demo}` : Promise.resolve([]),
    canOperateInventory ? db()`SELECT b.id,b.created_at,count(t.id)::integer AS total,count(t.id) FILTER(WHERE t.status='NEEDS_REVIEW')::integer AS review FROM ticket_import_batches b LEFT JOIN ticket_inventory t ON t.batch_id=b.id AND t.is_demo=${demo} GROUP BY b.id ORDER BY b.created_at DESC LIMIT 20` : Promise.resolve([]),
    user.role === "ADMIN" ? db()`SELECT id,name,email,role,created_at FROM users WHERE is_demo=${demo} ORDER BY created_at DESC LIMIT 50` : Promise.resolve([]),
    canViewFinance ? db()`SELECT id,donor_name,anonymous,amount,contribution_tier,status,created_at FROM donations WHERE is_demo=${demo} ORDER BY created_at DESC LIMIT 50` : Promise.resolve([]),
  ]);
  const payment = settingValue<{
    bank: string;
    account: string;
    holder: string;
  }>(settings[0]?.value);
  const stream = settingValue<{ videoId: string; state: string }>(
    streamSettings[0]?.value,
  );
  return (
    <main className="dashboard wrap section admin-dashboard">
      {demo && params.demoReset === "1" && <div className="demo-result" role="status">{en ? "Demo data restored." : "Data demo berhasil dipulihkan."}</div>}
      <div className="dashboard-head">
        <div>
          <p className="eyebrow">{t.operationsLabel} / SYMPHONY OF FAITH</p>
          <h1>{t.adminDashboard}</h1>
          <p>{t.transactionsAndInventoryFromTheDatabase}</p>
        </div>
        <a href="/account">{t.myAccount} ↗</a>
      </div>
      <nav className="admin-nav admin-sidebar" aria-label={t.adminSections}>
        <a href="#overview">{t.overview}</a>
        {canOperateInventory && <a href="#inventory">{t.inventory}</a>}
        {canCheckIn && <a href="#checkin">Check-in</a>}
        {canViewFinance && <a href="#payments">{t.payments}</a>}
        {canViewFinance && <a href="#donations">{t.donations}</a>}
        {canViewFinance && <a href="#notifications">{t.notifications}</a>}
        {canOperateStream && <a href="/admin/livestream">Livestream Ops ↗</a>}
        {user.role === "ADMIN" && <a href="#settings">{t.settings}</a>}
        {user.role === "ADMIN" && <a href="#users">{t.users}</a>}
      </nav>
      <section id="overview" className="dashboard-section">
        <p className="eyebrow">01 / OVERVIEW</p>
        <h2>{t.liveOverview}</h2>
        <div className="metric-grid">
          <div>
            <span>{t.confirmedOrders}</span>
            <strong>{summary[0]?.confirmed ?? 0}</strong>
          </div>
          <div>
            <span>{t.awaitingReview}</span>
            <strong>{summary[0]?.reviewing ?? 0}</strong>
          </div>
          <div>
            <span>{t.verifiedDonations}</span>
            <strong>
              {money(
                donations.find((d) => d.status === "VERIFIED")?.total ?? 0,
              )}
            </strong>
          </div>
          <div>
            <span>{en ? "Venue revenue" : "Pendapatan venue"}</span>
            <strong>{money(revenue.find((row) => row.mode === "VENUE")?.revenue ?? 0)}</strong>
          </div>
          <div>
            <span>{en ? "Livestream revenue" : "Pendapatan livestream"}</span>
            <strong>{money(revenue.find((row) => row.mode === "LIVESTREAM")?.revenue ?? 0)}</strong>
          </div>
        </div>
        <p className="hint">{t.ordersShowTheLatest100Transactions}</p>
        <div className="report-links">
          <a href="/api/admin/reports?kind=orders">{t.exportOrdersCSV} ↗</a>
          <a href="/api/admin/reports?kind=venue">Venue CSV ↗</a>
          <a href="/api/admin/reports?kind=livestream">Livestream CSV ↗</a>
          <a href="/api/admin/reports?kind=donations">
            {t.exportDonationsCSV} ↗
          </a>
        </div>
      </section>
      {canOperateInventory && <section id="inventory" className="dashboard-section">
        <p className="eyebrow">02 / INVENTORY</p>
        <h2>{t.ticketClassesOriginals}</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t.class}</th>
                <th>{t.capacity}</th>
                <th>{en ? "Sales target" : "Target penjualan"}</th>
                <th>{en ? "Purchase limit" : "Batas pembelian"}</th>
                <th>{t.available}</th>
                <th>{t.reserved}</th>
                <th>{t.sold}</th>
                <th>{t.sales}</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((row) => (
                <tr key={row.id}>
                  <th>
                    {row.mode} · {row.name}
                  </th>
                  <td>{row.capacity ?? "—"}</td>
                  <td>{row.sales_target ?? "—"}</td>
                  <td>{row.purchase_limit ?? "—"}</td>
                  <td>{row.mode === "VENUE" ? row.available : Math.max(0, Number(row.capacity) - Number(row.stream_reserved) - Number(row.stream_sold))}</td>
                  <td>{row.mode === "VENUE" ? row.reserved : row.stream_reserved}</td>
                  <td>{row.mode === "VENUE" ? row.sold : row.stream_sold}</td>
                  <td>
                    {user.role === "ADMIN" ? (
                      <form action={setTicketSale}>
                        <input type="hidden" name="classId" value={row.id} />
                        <input
                          type="hidden"
                          name="enabled"
                          value={row.sale_enabled ? "false" : "true"}
                        />
                        <button type="submit" className="secondary-button">
                          {row.sale_enabled ? t.closeSales : t.openSales}
                        </button>
                      </form>
                    ) : row.sale_enabled ? (
                      t.openSales
                    ) : (
                      t.closedSales
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {user.role === "ADMIN" && !demo && (
          <>
            <BatchImport
              classes={stock
                .filter((row) => row.mode === "VENUE")
                .map((row) => ({ id: String(row.id), name: String(row.name) }))}
            />
            <h3>{t.recentImports}</h3>
            {batches.length === 0 ? (
              <p className="empty">{t.noPDFImportsYet}</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>{t.time}</th>
                      <th>PDF</th>
                      <th>{t.needsReview}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => (
                      <tr key={batch.id}>
                        <td>{String(batch.id).slice(0, 8)}</td>
                        <td>
                          {new Date(batch.created_at).toLocaleString(
                            en ? "en-US" : "id-ID",
                            {
                              timeZone: "Asia/Jakarta",
                            },
                          )}{" "}
                          WIB
                        </td>
                        <td>{batch.total}</td>
                        <td>{batch.review}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <form
              className="panel admin-form"
              action="/api/admin/tickets"
              method="post"
              encType="multipart/form-data"
            >
              <h3>{t.importASinglePDF}</h3>
              <p>{t.useTheIssuerSManifestCode}</p>
              <label>
                {t.venueClass}
                <select name="classId" required>
                  {stock
                    .filter((row) => row.mode === "VENUE")
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                {t.manifestQRBarcode}
                <input name="barcode" required />
              </label>
              <label>
                {t.originalPDF}
                <input
                  type="file"
                  name="file"
                  accept="application/pdf"
                  required
                />
              </label>
              <button type="submit">{t.uploadForReview}</button>
            </form>
            <h3>
              {t.needsReview} ({review.length})
            </h3>
            {review.length === 0 ? (
              <p className="empty">{t.noPDFsAwaitingReview}</p>
            ) : (
              <div className="record-list">
                {review.map((row) => (
                  <div key={row.id} className="record">
                    <div>
                      <strong>
                        {row.name} · {row.original_name}
                      </strong>
                      <p>
                        {t.code}: {row.barcode}
                      </p>
                    </div>
                    <form action={verifyTicket}>
                      <input type="hidden" name="ticketId" value={row.id} />
                      <button type="submit">{t.approveAgainstManifest}</button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {demo && <p className="empty">{en ? "Demo PDFs are generated individually after simulated payment. No source PDF upload is required." : "PDF demo dibuat per tiket setelah pembayaran simulasi. Unggah PDF sumber tidak diperlukan."}</p>}
      </section>}
      {(user.role === "ADMIN" || user.role === "CHECK_IN") && (
        <section id="checkin" className="dashboard-section">
          <p className="eyebrow">ENTRY / VENUE</p>
          <h2>{t.checkInTickets}</h2>
          <p>
            {checkins[0]?.total ?? 0} {t.ticketsCheckedIn}
          </p>
          <DemoCheckIn locale={locale} />
        </section>
      )}
      {canViewFinance && <section id="payments" className="dashboard-section">
        <p className="eyebrow">03 / PAYMENTS</p>
        <h2>{t.ordersTransfers}</h2>
        <form className="order-filter" action="/admin" method="get">
          <label>
            {t.searchNameEmailOrID}
            <input name="q" defaultValue={q} />
          </label>
          <label>
            Status
            <select name="status" defaultValue={status}>
              <option value="ALL">{t.all}</option>
              {[
                "PENDING",
                "PAYMENT_REVIEW",
                "CONFIRMED",
                "CANCELLED",
                "EXPIRED",
                "FAILED",
              ].map((value) => (
                <option key={value} value={value}>
                  {secondaryStatus(locale, value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {en ? "From" : "Dari tanggal"}
            <input type="date" name="from" defaultValue={from} />
          </label>
          <label>
            {en ? "To" : "Sampai tanggal"}
            <input type="date" name="to" defaultValue={to} />
          </label>
          <button type="submit">{t.applyFilters}</button>
        </form>
        <form action={releaseExpired}>
          <button type="submit" className="secondary-button">
            {t.releaseExpiredBookings}
          </button>
        </form>
        {orders.length === 0 ? (
          <p className="empty">{t.noOrdersMatchTheseFilters}</p>
        ) : (
          <div className="record-list">
            {orders.map((order) => (
              <div className="record" key={order.id}>
                <div>
                  <strong>
                    {order.name} · {money(order.total)}
                  </strong>
                  <p>
                    {order.email} ·{" "}
                    <span className="status">
                      {secondaryStatus(locale, String(order.status))}
                    </span>
                  </p>
                  <small>
                    {order.id} · {t.expires}{" "}
                    {new Date(order.expires_at).toLocaleString(
                      en ? "en-US" : "id-ID",
                      {
                        timeZone: "Asia/Jakarta",
                      },
                    )}{" "}
                    WIB
                  </small>
                  {order.transfer_reference && (
                    <p>
                      {t.customerReference}: {order.transfer_reference}
                    </p>
                  )}
                </div>
                {order.status === "PAYMENT_REVIEW" && (
                  <form className="verify-form" action={confirmOrder}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <label>
                      {t.bankStatementReference}
                      <input name="bankReference" required minLength={4} />
                    </label>
                    <label>
                      {t.statementAmountRp}
                      <input
                        type="number"
                        name="receivedAmount"
                        required
                        min={1}
                      />
                    </label>
                    <label className="check">
                      <input type="checkbox" name="bankConfirmed" required />{" "}
                      {t.matchesTheBankStatement}
                    </label>
                    <button type="submit">{t.verifyTransfer}</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="pagination" aria-label={en ? "Order pages" : "Halaman pesanan"}>
          {page > 1 && <a href={`/admin?q=${encodeURIComponent(q)}&status=${status}&from=${from}&to=${to}&page=${page - 1}#payments`}>{en ? "Previous" : "Sebelumnya"}</a>}
          <span>{en ? "Page" : "Halaman"} {page}</span>
          {orders.length === 25 && <a href={`/admin?q=${encodeURIComponent(q)}&status=${status}&from=${from}&to=${to}&page=${page + 1}#payments`}>{en ? "Next" : "Berikutnya"}</a>}
        </div>
      </section>}
      {canViewFinance && <section id="donations" className="dashboard-section">
        <p className="eyebrow">04 / DONATIONS</p>
        <h2>{t.donations}</h2>
        <div className="metric-grid">
          {["PENDING", "VERIFIED", "EXPIRED"].map((status) => (
            <div key={status}>
              <span>{secondaryStatus(locale, status)}</span>
              <strong>
                {money(
                  donations.find((row) => row.status === status)?.total ?? 0,
                )}
              </strong>
            </div>
          ))}
        </div>
        {donationQueue.length === 0 ? (
          <p className="empty">{t.noDonationsAwaitingReview}</p>
        ) : (
          <div className="record-list">
            {donationQueue.map((row) => (
              <div className="record" key={row.id}>
                <div>
                  <strong>
                    {row.donor_name} · {money(row.amount)}
                  </strong>
                  <p>
                    {t.donorReference}: {row.payment_reference}
                  </p>
                </div>
                <form className="verify-form" action={verifyDonation}>
                  <input type="hidden" name="donationId" value={row.id} />
                  <label>
                    {t.bankStatementReference}
                    <input name="bankReference" required minLength={4} />
                  </label>
                  <label>
                    {t.statementAmountRp}
                    <input
                      type="number"
                      name="receivedAmount"
                      required
                      min={1}
                    />
                  </label>
                  <label className="check">
                    <input type="checkbox" name="bankConfirmed" required />{" "}
                    {t.matchesTheBankStatement}
                  </label>
                  <button type="submit">{t.verifyDonation}</button>
                </form>
              </div>
            ))}
          </div>
        )}
        <div className="record-list donation-history">
          {donationHistory.map((row) => (
            <div className="record" key={row.id}>
              <div><strong>{row.anonymous ? (en ? "Anonymous donor" : "Donatur anonim") : row.donor_name}</strong><p>{row.contribution_tier ? `${row.contribution_tier} · ` : ""}{money(row.amount)} · {secondaryStatus(locale, String(row.status))}</p></div>
              {demo && <span className="demo-receipt">SIMULATED</span>}
            </div>
          ))}
        </div>
      </section>}
      {canViewFinance && <section id="notifications" className="dashboard-section">
        <p className="eyebrow">05 / NOTIFICATIONS</p>
        <h2>{t.whatsAppQueue}</h2>
        {notifications.length === 0 ? (
          <p className="empty">{t.noNotificationsYet}</p>
        ) : (
          <div className="record-list notification-history">
            {notifications.map((row) => (
              <article className="record whatsapp-preview" key={row.id}>
                <div>
                  <strong>{row.name} · {row.kind}</strong>
                  <p className="status">{row.status}</p>
                  {messagePreview(row.demo_message) && <><p>{messagePreview(row.demo_message)?.title}</p><p>{messagePreview(row.demo_message)?.body}</p>{messagePreview(row.demo_message)?.tickets?.map((ticket) => <a key={ticket.url} href={ticket.url}>{ticket.name} · PDF</a>)}</>}
                </div>
                {demo && <span className="demo-receipt">WHATSAPP PREVIEW · SIMULATED</span>}
              </article>
            ))}
          </div>
        )}
        <p className="hint">{t.sendingStartsOnceOfficialWhatsAppCredentials}</p>
      </section>}
      {(user.role === "ADMIN" || user.role === "STREAM_OPERATOR") && (
        <section id="stream" className="dashboard-section">
          <p className="eyebrow">06 / LIVESTREAM</p>
          <h2>{t.streamControls}</h2>
          <p>{demo ? (en ? "Choose the simulated broadcast state. The demo player uses CC0 sample content." : "Pilih status siaran simulasi. Player demo memakai konten sampel CC0.") : t.useTheOfficialYouTubeVideoID}</p>
          <form className="panel admin-form" action={demo ? setDemoStreamState : configureStream}>
            {!demo && (
            <label>
              {t.youTubeVideoID}
              <input
                name="videoId"
                defaultValue={stream?.videoId ?? ""}
                minLength={11}
                maxLength={11}
                required
              />
            </label>
            )}
            <label>
              Status
              <select
                name="state"
                defaultValue={stream?.state ?? "NOT_STARTED"}
              >
                <option value="NOT_STARTED">{t.notStarted}</option>
                <option value="LIVE">Live</option>
                <option value="ENDED">{t.ended}</option>
              </select>
            </label>
            <button type="submit">{t.saveStreamStatus}</button>
          </form>
        </section>
      )}
      {user.role === "ADMIN" && (
        <section id="settings" className="dashboard-section">
          <p className="eyebrow">06 / SETTINGS</p>
          <h2>{t.paymentAccount}</h2>
          {!demo && <form className="panel admin-form" action={configurePayment}>
            <label>
              Bank
              <input name="bank" defaultValue={payment?.bank ?? ""} required />
            </label>
            <label>
              {t.accountNumber}
              <input
                name="account"
                defaultValue={payment?.account ?? ""}
                required
              />
            </label>
            <label>
              {t.accountHolder}
              <input
                name="holder"
                defaultValue={payment?.holder ?? ""}
                required
              />
            </label>
            <button type="submit">{t.saveTransferInstructions}</button>
          </form>}
          {demo && (
            <div className="demo-reset-panel">
              <h3>{en ? "Client demo data" : "Data demo klien"}</h3>
              <p>{en ? "Restore seeded examples and the official 1,685-ticket venue inventory." : "Pulihkan contoh awal dan inventaris venue resmi 1.685 tiket."}</p>
              <DemoReset locale={locale} />
            </div>
          )}
        </section>
      )}
      {user.role === "ADMIN" && (
        <section id="users" className="dashboard-section">
          <p className="eyebrow">07 / ACCESS</p>
          <h2>{t.usersRoles}</h2>
          <p>{t.latest50AccountsRoleChangesAre}</p>
          <div className="record-list">
            {users.map((account) => (
              <div className="record" key={account.id}>
                <div>
                  <strong>{account.name}</strong>
                  <p>
                    {account.email} · {account.role}
                  </p>
                </div>
                <form className="verify-form" action={setUserRole}>
                  <input type="hidden" name="userId" value={account.id} />
                  <label>
                    {t.role}
                    <select name="role" defaultValue={account.role}>
                      <option value="CUSTOMER">Customer</option>
                      <option value="FINANCE">Finance</option>
                      <option value="CHECK_IN">Check-in</option>
                      <option value="STREAM_OPERATOR">Livestream Operator</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </label>
                  <button type="submit">{t.saveRole}</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
