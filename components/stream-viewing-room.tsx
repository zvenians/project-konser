"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { StreamConfig } from "@/lib/streaming";
import type { PlaybackAccess } from "@/lib/providers";

type Payload = { session: string; config: StreamConfig; playback: PlaybackAccess | null; youtubeNotice?: string };
export function StreamViewingRoom({ locale }: { locale: "id" | "en" }) {
  const en = locale === "en";
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [now, setNow] = useState(0);
  const load = useCallback(async (takeover = false) => {
    setBusy(true);
    const session = localStorage.getItem("sof_stream_session") || "";
    const response = await fetch(`/api/livestream/access?session=${encodeURIComponent(session)}${takeover ? "&takeover=1" : ""}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error || "PLAYBACK_UNAVAILABLE"); setBusy(false); return; }
    localStorage.setItem("sof_stream_session", payload.session);
    setData(payload); setError(""); setBusy(false);
  }, []);
  useEffect(() => { const initial = setTimeout(() => load(), 0); const poll = setInterval(() => load(), 15_000); const clock = setInterval(() => setNow(Date.now()), 1_000); return () => { clearTimeout(initial); clearInterval(poll); clearInterval(clock); }; }, [load]);
  useEffect(() => { if (!data?.session) return; const heartbeat = setInterval(() => fetch("/api/livestream/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session: data.session }) }), 20_000); return () => clearInterval(heartbeat); }, [data?.session]);
  const countdown = useMemo(() => {
    const target = new Date(data?.config.scheduledStart || "2027-02-07T19:00:00+07:00").getTime();
    const seconds = Math.max(0, Math.floor((target - now) / 1000));
    const d = Math.floor(seconds / 86400), h = Math.floor(seconds % 86400 / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds % 60;
    return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  }, [data?.config.scheduledStart, now]);
  const state = data?.config.state || "NOT_STARTED";
  const playerReady = data?.config.viewerAccess && state === "LIVE" && data.playback;
  return <main className="stream-room">
    <header className="stream-room-head">
      <div><p className="eyebrow">SYMPHONY OF FAITH / LIVESTREAM</p><h1>{en ? "Live viewing room" : "Ruang tayang langsung"}</h1><p>{en ? "Sunday, 7 February 2027 · 19:00 WIB" : "Minggu, 7 Februari 2027 · 19.00 WIB"}</p></div>
      <Link href="/claim-ticket">← {en ? "Back to ticket claim" : "Kembali ke Claim Ticket"}</Link>
    </header>
    <section className="stream-stage" aria-live="polite">
      <div className="stream-status-line"><span className={`broadcast-dot state-${state.toLowerCase()}`} />{state.replace("_", " ")}<span>{en ? "Access verified" : "Akses terverifikasi"}</span></div>
      <div className="stream-frame">
        {playerReady && data.playback?.provider === "youtube" && <iframe title="Symphony of Faith YouTube Live" src={`https://www.youtube-nocookie.com/embed/${data.playback.videoId}?playsinline=1&rel=0`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
        {playerReady && data.playback?.provider === "cloudflare" && <iframe title="Symphony of Faith private livestream" src={data.playback.iframeUrl} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />}
        {playerReady && data.playback?.provider === "simulation" && data.playback.sampleUrl && <video controls playsInline poster="/brand/church-hero-desktop.webp"><source src={data.playback.sampleUrl} /></video>}
        {!playerReady && <div className="stream-waiting" style={{ backgroundImage: "linear-gradient(180deg,rgba(6,8,12,.18),rgba(6,8,12,.86)),url('/brand/church-hero-desktop.webp')" }}>
          <p className="eyebrow">{state === "ENDED" ? (en ? "BROADCAST ENDED" : "SIARAN SELESAI") : (en ? "BROADCAST WAITING ROOM" : "RUANG TUNGGU SIARAN")}</p>
          <h2>{state === "INTERRUPTED" ? (en ? "Broadcast interrupted" : "Siaran terputus") : (en ? "The broadcast will appear here" : "Siaran akan tampil di sini")}</h2>
          {state !== "ENDED" && <strong>{countdown}</strong>}
          {data?.config.maintenanceMessage && <p>{data.config.maintenanceMessage}</p>}
        </div>}
      </div>
      {busy && <p className="stream-feedback">{en ? "Checking broadcast…" : "Memeriksa siaran…"}</p>}
      {error && <div className="stream-feedback error"><strong>{error === "SESSION_LIMIT_REACHED" ? (en ? "Viewer limit reached on another device." : "Batas penonton aktif di perangkat lain.") : (en ? "Playback is temporarily unavailable." : "Tayangan sementara tidak tersedia.")}</strong><div><button onClick={() => load()}>{en ? "Retry" : "Coba lagi"}</button>{error === "SESSION_LIMIT_REACHED" && <button className="secondary-button" onClick={() => load(true)}>{en ? "Take over this session" : "Ambil alih sesi"}</button>}</div></div>}
      {data?.youtubeNotice && <p className="stream-notice">{en ? "Application access is restricted, but an unlisted YouTube URL can still be shared outside this website." : "Akses aplikasi dibatasi, tetapi URL YouTube unlisted tetap dapat dibagikan di luar situs ini."}</p>}
    </section>
    <section className="stream-instructions"><div><p className="eyebrow">01 / ACCESS</p><h2>{en ? "Your access" : "Akses Anda"}</h2><p>{en ? "Keep this page open. Status and access refresh automatically." : "Biarkan halaman ini terbuka. Status dan akses diperbarui otomatis."}</p></div><div><p className="eyebrow">02 / SUPPORT</p><h2>{en ? "Playback help" : "Bantuan tayangan"}</h2><p>{en ? "Use a stable connection, disable battery saving, and retry if playback stops." : "Gunakan koneksi stabil, nonaktifkan penghemat baterai, lalu coba lagi jika tayangan berhenti."}</p></div></section>
  </main>;
}
