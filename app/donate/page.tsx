import { submitDonation } from "@/app/actions";
import Link from "next/link";
import { db } from "@/lib/db";
import { settingValue } from "@/lib/settings";

export const dynamic = "force-dynamic";
export default async function DonatePage() {
  const [setting] =
    await db()`SELECT value FROM site_settings WHERE key='payment_instructions'`;
  const payment = settingValue<{
    bank: string;
    account: string;
    holder: string;
  }>(setting?.value);
  return (
    <main className="wrap section">
      <p className="eyebrow">SYMPHONY OF FAITH / DONASI</p>
      <h1>Kontribusi dengan kepedulian.</h1>
      <p>
        Donasi dicatat terpisah dari tiket dan baru dihitung setelah transfer
        dikonfirmasi petugas.
      </p>
      {payment?.bank ? (
        <div className="split">
          <div className="payment-box">
            <h2>Instruksi transfer</h2>
            <p>
              Bank {payment.bank}
              <br />
              Rekening {payment.account}
              <br />
              a.n. {payment.holder}
            </p>
            <p>
              Masukkan referensi transfer setelah pembayaran. Jangan kirim
              donasi jika rekening tidak sesuai dengan informasi resmi
              penyelenggara.
            </p>
          </div>
          <form className="panel" action={submitDonation}>
            <label>
              Nama donatur
              <input name="name" minLength={2} maxLength={100} required />
            </label>
            <label>
              Jumlah donasi (Rp)
              <input
                name="amount"
                type="number"
                min={10000}
                max={100000000}
                step={1000}
                required
              />
            </label>
            <label>
              Referensi transfer
              <input name="reference" minLength={4} maxLength={100} required />
            </label>
            <label className="check">
              <input type="checkbox" name="anonymous" /> Tampilkan sebagai
              anonim jika laporan publik diterbitkan
            </label>
            <button type="submit">Ajukan verifikasi donasi</button>
          </form>
        </div>
      ) : (
        <p className="empty">
          Donasi belum dibuka. Instruksi rekening resmi masih disiapkan.
        </p>
      )}
      <Link href="/">← Kembali ke beranda</Link>
    </main>
  );
}
