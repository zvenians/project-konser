import { redirect } from "next/navigation";
import {
  configurePayment,
  configureStream,
  confirmOrder,
  checkInTicket,
  releaseExpired,
  setTicketSale,
  setUserRole,
  verifyDonation,
  verifyTicket,
} from "@/app/actions";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { settingValue } from "@/lib/settings";
import { BatchImport } from "@/components/batch-import";

const money = (value: number | string) =>
  `Rp${Number(value).toLocaleString("id-ID")}`;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await currentUser();
  if (!user || !["ADMIN", "FINANCE"].includes(user.role)) redirect("/login");
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const status = [
    "PENDING",
    "PAYMENT_REVIEW",
    "CONFIRMED",
    "CANCELLED",
    "EXPIRED",
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
    checkins,
    batches,
    users,
  ] = await Promise.all([
    db()`SELECT c.id,c.name,c.mode,c.capacity,c.sale_enabled,count(t.id) FILTER(WHERE t.status='AVAILABLE') AS available,count(t.id) FILTER(WHERE t.status='RESERVED') AS reserved,count(t.id) FILTER(WHERE t.status='SOLD') AS sold FROM ticket_classes c LEFT JOIN ticket_inventory t ON t.class_id=c.id GROUP BY c.id ORDER BY c.mode,c.price DESC`,
    db()`SELECT o.id,o.status,o.total,o.expires_at,u.name,u.email,p.transfer_reference FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN payment_claims p ON p.order_id=o.id WHERE (${q}='' OR u.name ILIKE ${`%${q}%`} OR u.email ILIKE ${`%${q}%`} OR o.id::text ILIKE ${`%${q}%`}) AND (${status}='ALL' OR o.status=${status}) ORDER BY o.created_at DESC LIMIT 100`,
    db()`SELECT status,count(*) AS count,coalesce(sum(amount),0) AS total FROM donations GROUP BY status`,
    db()`SELECT t.id,c.name,t.barcode,t.original_name FROM ticket_inventory t JOIN ticket_classes c ON c.id=t.class_id WHERE t.status='NEEDS_REVIEW' ORDER BY t.id LIMIT 50`,
    db()`SELECT id,donor_name,amount,payment_reference FROM donations WHERE status='PENDING' AND expires_at>now() ORDER BY created_at LIMIT 50`,
    db()`SELECT value FROM site_settings WHERE key='payment_instructions'`,
    db()`SELECT kind,status,count(*) AS count FROM notification_outbox GROUP BY kind,status`,
    db()`SELECT value FROM site_settings WHERE key='stream'`,
    db()`SELECT count(*) FILTER (WHERE status='CONFIRMED')::integer AS confirmed,count(*) FILTER (WHERE status='PAYMENT_REVIEW')::integer AS reviewing FROM orders`,
    db()`SELECT count(*)::integer AS total FROM ticket_checkins`,
    db()`SELECT b.id,b.created_at,count(t.id)::integer AS total,count(t.id) FILTER(WHERE t.status='NEEDS_REVIEW')::integer AS review FROM ticket_import_batches b LEFT JOIN ticket_inventory t ON t.batch_id=b.id GROUP BY b.id ORDER BY b.created_at DESC LIMIT 20`,
    db()`SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC LIMIT 50`,
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
    <main className="dashboard wrap section">
      <div className="dashboard-head">
        <div>
          <p className="eyebrow">OPERASIONAL / SYMPHONY OF FAITH</p>
          <h1>Pusat pengelolaan</h1>
          <p>Data transaksi dan inventaris dari database.</p>
        </div>
        <a href="/account">Akun saya ↗</a>
      </div>
      <nav className="admin-nav" aria-label="Modul admin">
        <a href="#overview">Ringkasan</a>
        <a href="#inventory">Inventaris</a>
        <a href="#checkin">Check-in</a>
        <a href="#payments">Pembayaran</a>
        <a href="#donations">Donasi</a>
        <a href="#notifications">Notifikasi</a>
        <a href="#stream">Livestream</a>
        <a href="#settings">Pengaturan</a>
        {user.role === "ADMIN" && <a href="#users">Pengguna</a>}
      </nav>
      <section id="overview" className="dashboard-section">
        <p className="eyebrow">01 / OVERVIEW</p>
        <h2>Ringkasan langsung</h2>
        <div className="metric-grid">
          <div>
            <span>Pesanan terkonfirmasi</span>
            <strong>{summary[0]?.confirmed ?? 0}</strong>
          </div>
          <div>
            <span>Menunggu verifikasi</span>
            <strong>{summary[0]?.reviewing ?? 0}</strong>
          </div>
          <div>
            <span>Donasi terverifikasi</span>
            <strong>
              {money(
                donations.find((d) => d.status === "VERIFIED")?.total ?? 0,
              )}
            </strong>
          </div>
        </div>
        <p className="hint">
          Daftar pesanan memuat 100 transaksi terbaru. Statistik dihitung dari
          seluruh transaksi.
        </p>
        <div className="report-links">
          <a href="/api/admin/reports?kind=orders">Ekspor pesanan CSV ↗</a>
          <a href="/api/admin/reports?kind=donations">Ekspor donasi CSV ↗</a>
        </div>
      </section>
      <section id="inventory" className="dashboard-section">
        <p className="eyebrow">02 / INVENTORY</p>
        <h2>Kelas & tiket asli</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Kelas</th>
                <th>Kapasitas</th>
                <th>Tersedia</th>
                <th>Dipesan</th>
                <th>Terjual</th>
                <th>Penjualan</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((row) => (
                <tr key={row.id}>
                  <th>
                    {row.mode} · {row.name}
                  </th>
                  <td>{row.capacity ?? "—"}</td>
                  <td>{row.mode === "VENUE" ? row.available : "—"}</td>
                  <td>{row.reserved}</td>
                  <td>{row.sold}</td>
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
                          {row.sale_enabled ? "Tutup" : "Buka"}
                        </button>
                      </form>
                    ) : row.sale_enabled ? (
                      "Buka"
                    ) : (
                      "Tutup"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {user.role === "ADMIN" && (
          <>
            <BatchImport
              classes={stock
                .filter((row) => row.mode === "VENUE")
                .map((row) => ({ id: String(row.id), name: String(row.name) }))}
            />
            <h3>Riwayat impor terbaru</h3>
            {batches.length === 0 ? (
              <p className="empty">Belum ada impor PDF.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Waktu</th>
                      <th>PDF</th>
                      <th>Perlu review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => (
                      <tr key={batch.id}>
                        <td>{String(batch.id).slice(0, 8)}</td>
                        <td>
                          {new Date(batch.created_at).toLocaleString("id-ID", {
                            timeZone: "Asia/Jakarta",
                          })}{" "}
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
              <h3>Impor PDF individual</h3>
              <p>
                Gunakan kode dari manifest penerbit. PDF menunggu review sebelum
                tersedia untuk dijual.
              </p>
              <label>
                Kelas venue
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
                Kode QR/barcode manifest
                <input name="barcode" required />
              </label>
              <label>
                PDF asli
                <input
                  type="file"
                  name="file"
                  accept="application/pdf"
                  required
                />
              </label>
              <button type="submit">Unggah untuk review</button>
            </form>
            <h3>Perlu review ({review.length})</h3>
            {review.length === 0 ? (
              <p className="empty">Belum ada PDF menunggu review.</p>
            ) : (
              <div className="record-list">
                {review.map((row) => (
                  <div key={row.id} className="record">
                    <div>
                      <strong>
                        {row.name} · {row.original_name}
                      </strong>
                      <p>Kode: {row.barcode}</p>
                    </div>
                    <form action={verifyTicket}>
                      <input type="hidden" name="ticketId" value={row.id} />
                      <button type="submit">Setujui sesuai manifest</button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
      {user.role === "ADMIN" && (
        <section id="checkin" className="dashboard-section">
          <p className="eyebrow">ENTRY / VENUE</p>
          <h2>Validasi tiket masuk</h2>
          <p>{checkins[0]?.total ?? 0} tiket sudah digunakan untuk masuk.</p>
          <form className="panel admin-form" action={checkInTicket}>
            <label>
              Kode barcode/QR dari PDF asli
              <input name="barcode" required minLength={3} />
            </label>
            <button type="submit">Validasi & catat masuk</button>
          </form>
        </section>
      )}
      <section id="payments" className="dashboard-section">
        <p className="eyebrow">03 / PAYMENTS</p>
        <h2>Pesanan & transfer</h2>
        <form className="order-filter" action="/admin" method="get">
          <label>
            Cari nama, email, atau ID
            <input name="q" defaultValue={q} />
          </label>
          <label>
            Status
            <select name="status" defaultValue={status}>
              <option value="ALL">Semua</option>
              {[
                "PENDING",
                "PAYMENT_REVIEW",
                "CONFIRMED",
                "CANCELLED",
                "EXPIRED",
              ].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Terapkan filter</button>
        </form>
        <form action={releaseExpired}>
          <button type="submit" className="secondary-button">
            Lepaskan reservasi kedaluwarsa
          </button>
        </form>
        {orders.length === 0 ? (
          <p className="empty">Tidak ada pesanan sesuai filter.</p>
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
                    <span className="status">{order.status}</span>
                  </p>
                  <small>
                    {order.id} · Berakhir{" "}
                    {new Date(order.expires_at).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}{" "}
                    WIB
                  </small>
                  {order.transfer_reference && (
                    <p>Referensi pembeli: {order.transfer_reference}</p>
                  )}
                </div>
                {order.status === "PAYMENT_REVIEW" && (
                  <form className="verify-form" action={confirmOrder}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <label>
                      Referensi mutasi bank
                      <input name="bankReference" required minLength={4} />
                    </label>
                    <label>
                      Jumlah di mutasi (Rp)
                      <input
                        type="number"
                        name="receivedAmount"
                        required
                        min={1}
                      />
                    </label>
                    <label className="check">
                      <input type="checkbox" name="bankConfirmed" required />{" "}
                      Sudah cocok dengan mutasi rekening
                    </label>
                    <button type="submit">Verifikasi transfer</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <section id="donations" className="dashboard-section">
        <p className="eyebrow">04 / DONATIONS</p>
        <h2>Donasi</h2>
        <div className="metric-grid">
          {["PENDING", "VERIFIED", "EXPIRED"].map((status) => (
            <div key={status}>
              <span>{status}</span>
              <strong>
                {money(
                  donations.find((row) => row.status === status)?.total ?? 0,
                )}
              </strong>
            </div>
          ))}
        </div>
        {donationQueue.length === 0 ? (
          <p className="empty">Tidak ada donasi menunggu verifikasi.</p>
        ) : (
          <div className="record-list">
            {donationQueue.map((row) => (
              <div className="record" key={row.id}>
                <div>
                  <strong>
                    {row.donor_name} · {money(row.amount)}
                  </strong>
                  <p>Referensi pembeli: {row.payment_reference}</p>
                </div>
                <form className="verify-form" action={verifyDonation}>
                  <input type="hidden" name="donationId" value={row.id} />
                  <label>
                    Referensi mutasi bank
                    <input name="bankReference" required minLength={4} />
                  </label>
                  <label>
                    Jumlah di mutasi (Rp)
                    <input
                      type="number"
                      name="receivedAmount"
                      required
                      min={1}
                    />
                  </label>
                  <label className="check">
                    <input type="checkbox" name="bankConfirmed" required />{" "}
                    Sudah cocok dengan mutasi rekening
                  </label>
                  <button type="submit">Verifikasi donasi</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
      <section id="notifications" className="dashboard-section">
        <p className="eyebrow">05 / NOTIFICATIONS</p>
        <h2>Antrean WhatsApp</h2>
        {notifications.length === 0 ? (
          <p className="empty">Belum ada notifikasi.</p>
        ) : (
          <ul>
            {notifications.map((row) => (
              <li key={`${row.kind}-${row.status}`}>
                {row.kind} · {row.status} · {row.count}
              </li>
            ))}
          </ul>
        )}
        <p className="hint">
          Pengiriman aktif hanya setelah kredensial WhatsApp resmi dan template
          disiapkan.
        </p>
      </section>
      {user.role === "ADMIN" && (
        <section id="stream" className="dashboard-section">
          <p className="eyebrow">06 / LIVESTREAM</p>
          <h2>Kontrol siaran</h2>
          <p>
            Gunakan ID video YouTube resmi. Pemutar hanya diberikan kepada akun
            yang memiliki hak akses terverifikasi.
          </p>
          <form className="panel admin-form" action={configureStream}>
            <label>
              ID video YouTube
              <input
                name="videoId"
                defaultValue={stream?.videoId ?? ""}
                minLength={11}
                maxLength={11}
                required
              />
            </label>
            <label>
              Status
              <select
                name="state"
                defaultValue={stream?.state ?? "NOT_STARTED"}
              >
                <option value="NOT_STARTED">Belum dimulai</option>
                <option value="LIVE">Live</option>
                <option value="ENDED">Berakhir</option>
              </select>
            </label>
            <button type="submit">Simpan status siaran</button>
          </form>
        </section>
      )}
      {user.role === "ADMIN" && (
        <section id="settings" className="dashboard-section">
          <p className="eyebrow">06 / SETTINGS</p>
          <h2>Rekening pembayaran</h2>
          <form className="panel admin-form" action={configurePayment}>
            <label>
              Bank
              <input name="bank" defaultValue={payment?.bank ?? ""} required />
            </label>
            <label>
              Nomor rekening
              <input
                name="account"
                defaultValue={payment?.account ?? ""}
                required
              />
            </label>
            <label>
              Atas nama
              <input
                name="holder"
                defaultValue={payment?.holder ?? ""}
                required
              />
            </label>
            <button type="submit">Simpan instruksi transfer</button>
          </form>
        </section>
      )}
      {user.role === "ADMIN" && (
        <section id="users" className="dashboard-section">
          <p className="eyebrow">07 / ACCESS</p>
          <h2>Pengguna & peran</h2>
          <p>50 akun terbaru. Perubahan peran dicatat di audit log.</p>
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
                    Peran
                    <select name="role" defaultValue={account.role}>
                      <option value="CUSTOMER">Customer</option>
                      <option value="FINANCE">Finance</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </label>
                  <button type="submit">Simpan peran</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
