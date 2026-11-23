import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap section">
      <p className="eyebrow">404 / SYMPHONY OF FAITH</p>
      <h1>Halaman tidak ditemukan.</h1>
      <p>Alamat yang Anda buka mungkin berubah.</p>
      <Link href="/">Kembali ke beranda ↗</Link>
    </main>
  );
}
