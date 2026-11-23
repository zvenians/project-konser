import Link from "next/link";

export default function DonationReceived() {
  return (
    <main className="wrap section">
      <h1>Niat donasi tercatat</h1>
      <p>Donasi akan dihitung setelah diverifikasi oleh penyelenggara.</p>
      <Link href="/">Kembali ke beranda</Link>
    </main>
  );
}
