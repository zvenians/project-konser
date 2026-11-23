import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Countdown } from "@/components/countdown";
import { settingValue } from "@/lib/settings";
import { getLocale } from "@/lib/i18n";
import { secondaryMessages } from "@/lib/secondary-messages";

export const dynamic = "force-dynamic";
export default async function LivestreamPage() {
  const t = secondaryMessages(await getLocale()).livestream;
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
      <h1>{t.watchLiveFromAnywhere}</h1>
      <p>{t.eventDate} · 19.00–22.00 WIB</p>
      <Countdown />
      {!allowed ? (
        <div className="empty">
          <h2>{t.accessNotActive}</h2>
          <p>{t.thisStreamIsAvailableToAccounts}</p>
          <a href="/account">{t.viewMyOrders} ↗</a>
        </div>
      ) : stream?.state === "LIVE" && stream.videoId ? (
        <div className="stream-player">
          <iframe
            title={t.symphonyOfFaithLivestream}
            src={`https://www.youtube-nocookie.com/embed/${stream.videoId}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <div className="empty">
          <h2>
            {stream?.state === "ENDED" ? t.streamEnded : t.streamNotStarted}
          </h2>
          <p>{t.yourAccessIsActiveThePlayer}</p>
        </div>
      )}
      <a href="/account">← {t.backToAccount}</a>
    </main>
  );
}
