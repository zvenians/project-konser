import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Countdown } from "@/components/countdown";
import { settingValue } from "@/lib/settings";

export const dynamic = "force-dynamic";
export default async function LivestreamPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const [entitlement, setting] = await Promise.all([
    db()`SELECT 1 FROM stream_entitlements s JOIN orders o ON o.id=s.order_id WHERE s.user_id=${user.id} AND s.active=true AND o.status='CONFIRMED' LIMIT 1`,
    db()`SELECT value FROM site_settings WHERE key='stream'`,
  ]);
  const stream = settingValue<{ state: string; videoId: string }>(
    setting[0]?.value,
  );
  const allowed = entitlement.length > 0;
  return (
    <main className="dashboard wrap section">
      <p className="eyebrow">SYMPHONY OF FAITH / LIVESTREAM</p>
      <h1>Ikuti konser dari mana saja.</h1>
      <p>7 Februari 2027 · 19.00–22.00 WIB</p>
      <Countdown />
      {!allowed ? (
        <div className="empty">
          <h2>Akses belum aktif</h2>
          <p>
            Halaman ini hanya tersedia untuk akun dengan tiket livestream yang
            pembayarannya sudah diverifikasi.
          </p>
          <a href="/account">Lihat pesanan saya ↗</a>
        </div>
      ) : stream?.state === "LIVE" && stream.videoId ? (
        <div className="stream-player">
          <iframe
            title="Siaran Symphony of Faith"
            src={`https://www.youtube-nocookie.com/embed/${stream.videoId}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <div className="empty">
          <h2>
            {stream?.state === "ENDED"
              ? "Siaran telah berakhir"
              : "Siaran belum dimulai"}
          </h2>
          <p>
            Akses Anda aktif. Pemutar akan muncul ketika penyelenggara memulai
            siaran.
          </p>
        </div>
      )}
      <a href="/account">← Kembali ke akun</a>
    </main>
  );
}
