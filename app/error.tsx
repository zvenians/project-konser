"use client";
import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="wrap section">
      <p className="eyebrow">SYMPHONY OF FAITH</p>
      <h1>Permintaan belum berhasil.</h1>
      <p>
        Periksa kembali data Anda, lalu coba lagi. Jika masalah berlanjut,
        hubungi penyelenggara melalui kanal resmi.
      </p>
      <button type="button" onClick={reset} className="secondary-button">
        Coba lagi
      </button>
      <p>
        <Link href="/">Kembali ke beranda ↗</Link>
      </p>
    </main>
  );
}
