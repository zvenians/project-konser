import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasCapability } from "@/lib/permissions";
import { settingValue } from "@/lib/settings";
import { createStreamingProvider } from "@/lib/providers";
import { normalizeStreamConfig, broadcastStates } from "@/lib/streaming";
import { updateLivestreamOperations, revokeStreamEntitlement, endViewerSession } from "@/app/actions";
import { demoModeEnabled } from "@/lib/demo-config";
import { getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export default async function LivestreamOperations({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await currentUser();
  if (!user || !hasCapability(user.role, "stream")) redirect("/login");
  const en = (await getLocale()) === "en", demo = demoModeEnabled(), params = await searchParams;
  const [setting, sales, sessions, entitlements, logs] = await Promise.all([
    db()`SELECT value FROM site_settings WHERE key='stream'`,
    db()`SELECT count(DISTINCT o.id)::integer AS orders,coalesce(sum(i.quantity),0)::integer AS packages FROM orders o JOIN order_items i ON i.order_id=o.id JOIN ticket_classes c ON c.id=i.class_id WHERE o.is_demo=${demo} AND o.status='CONFIRMED' AND c.mode='LIVESTREAM'`,
    db()`SELECT s.id,s.last_heartbeat,u.name,u.email FROM stream_viewer_sessions s JOIN users u ON u.id=s.user_id WHERE s.active=true AND s.last_heartbeat>now()-interval '45 seconds' ORDER BY s.last_heartbeat DESC`,
    db()`SELECT s.id,u.name,u.email,s.active,s.revoked_at FROM stream_entitlements s JOIN users u ON u.id=s.user_id JOIN orders o ON o.id=s.order_id WHERE o.is_demo=${demo} AND o.status='CONFIRMED' ORDER BY s.id DESC LIMIT 50`,
    db()`SELECT action,details,created_at FROM audit_logs WHERE action IN ('UPDATE_LIVESTREAM_OPERATIONS','REVOKE_STREAM_ENTITLEMENT','END_STREAM_VIEWER_SESSION','STREAM_SESSION_TAKEOVER') ORDER BY created_at DESC LIMIT 30`,
  ]);
  const config = normalizeStreamConfig(settingValue(setting[0]?.value));
  const connection = await createStreamingProvider(config.provider).connectionStatus();
  return <main className="dashboard wrap section admin-dashboard">
    <div className="dashboard-head"><div><p className="eyebrow">STREAM OPERATOR / SYMPHONY OF FAITH</p><h1>{en ? "Livestream operations" : "Operasi livestream"}</h1><p>{en ? "Website playback control—not OBS or YouTube broadcast control." : "Kontrol akses tayangan situs—bukan kontrol siaran OBS atau YouTube."}</p></div><a href="/admin">← Admin</a></div>
    {params.saved === "1" && <div className="demo-result">{en ? "Livestream configuration saved." : "Konfigurasi livestream tersimpan."}</div>}
    <div className="metric-grid"><div><span>{en ? "Confirmed orders" : "Pesanan terkonfirmasi"}</span><strong>{sales[0]?.orders ?? 0}</strong></div><div><span>{en ? "Packages sold" : "Paket terjual"}</span><strong>{sales[0]?.packages ?? 0}</strong></div><div><span>{en ? "Active app sessions" : "Sesi aplikasi aktif"}</span><strong>{sessions.length}</strong></div><div><span>{en ? "Provider status" : "Status provider"}</span><strong>{connection}</strong></div></div>
    <section className="dashboard-section"><p className="eyebrow">01 / CONTROL</p><h2>{en ? "Playback availability" : "Ketersediaan tayangan"}</h2>
      <form className="panel admin-form" action={updateLivestreamOperations}>
        <label>Provider<select name="provider" defaultValue={config.provider}><option value="simulation">Simulation</option><option value="youtube">YouTube Live</option><option value="cloudflare">Cloudflare Stream</option></select></label>
        <label>{en ? "YouTube URL / video ID or Cloudflare video UID" : "URL / ID video YouTube atau UID video Cloudflare"}<input name="videoSource" defaultValue={config.videoId || ""} /></label>
        <label>{en ? "Broadcast state" : "Status siaran"}<select name="state" defaultValue={config.state}>{broadcastStates.map(state => <option key={state}>{state}</option>)}</select></label>
        <label>{en ? "Scheduled start (ISO, WIB)" : "Jadwal mulai (ISO, WIB)"}<input name="scheduledStart" defaultValue={config.scheduledStart} required /></label>
        <label>{en ? "Scheduled end (ISO, WIB)" : "Jadwal selesai (ISO, WIB)"}<input name="scheduledEnd" defaultValue={config.scheduledEnd} required /></label>
        <label>{en ? "Viewer sessions per customer" : "Sesi penonton per pelanggan"}<input type="number" name="sessionLimit" min="1" max="5" defaultValue={config.sessionLimit} required /></label>
        <label>{en ? "Emergency maintenance message" : "Pesan pemeliharaan darurat"}<textarea name="maintenanceMessage" maxLength={300} defaultValue={config.maintenanceMessage} /></label>
        <label><input type="checkbox" name="viewerAccess" defaultChecked={config.viewerAccess} /> {en ? "Allow website playback" : "Izinkan tayangan di situs"}</label>
        <button type="submit">{en ? "Save operations state" : "Simpan status operasi"}</button>
      </form>
      <p className="hint">{en ? "OBS must be configured and started separately in YouTube Studio. This page never exposes or controls stream keys." : "OBS harus dikonfigurasi dan dijalankan terpisah melalui YouTube Studio. Halaman ini tidak menampilkan atau mengontrol stream key."}</p>
    </section>
    <section className="dashboard-section"><p className="eyebrow">02 / PREVIEW</p><h2>{en ? "Broadcast preview" : "Pratinjau siaran"}</h2>{config.provider === "youtube" && config.videoId ? <div className="stream-frame"><iframe title="Operator YouTube preview" src={`https://www.youtube-nocookie.com/embed/${config.videoId}?playsinline=1&rel=0`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div> : <p className="empty">{en ? "No provider preview available." : "Pratinjau provider belum tersedia."}</p>}</section>
    <section className="dashboard-section"><p className="eyebrow">03 / SESSIONS</p><h2>{en ? "Active viewing sessions" : "Sesi penonton aktif"}</h2>{sessions.length ? <div className="record-list">{sessions.map(session => <article className="record" key={session.id}><div><strong>{session.name}</strong><p>{session.email} · {new Date(session.last_heartbeat).toLocaleTimeString(en ? "en-US" : "id-ID", { timeZone: "Asia/Jakarta" })} WIB</p></div><form action={endViewerSession}><input type="hidden" name="sessionId" value={session.id} /><button className="secondary-button">{en ? "End session" : "Akhiri sesi"}</button></form></article>)}</div> : <p className="empty">{en ? "No active application sessions." : "Tidak ada sesi aplikasi aktif."}</p>}</section>
    <section className="dashboard-section"><p className="eyebrow">04 / ENTITLEMENTS</p><h2>{en ? "Customer access" : "Akses pelanggan"}</h2><div className="record-list">{entitlements.map(item => <article className="record" key={item.id}><div><strong>{item.name}</strong><p>{item.email} · {item.active && !item.revoked_at ? "ACTIVE" : "REVOKED"}</p></div>{item.active && !item.revoked_at && <form action={revokeStreamEntitlement}><input type="hidden" name="entitlementId" value={item.id} /><button className="secondary-button">{en ? "Revoke" : "Cabut akses"}</button></form>}</article>)}</div></section>
    <section className="dashboard-section"><p className="eyebrow">05 / AUDIT</p><h2>{en ? "Broadcast activity" : "Aktivitas siaran"}</h2><div className="record-list">{logs.map((log, index) => <article className="record" key={index}><div><strong>{log.action}</strong><p>{new Date(log.created_at).toLocaleString(en ? "en-US" : "id-ID", { timeZone: "Asia/Jakarta" })} WIB</p></div></article>)}</div></section>
  </main>;
}
