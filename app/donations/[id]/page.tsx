import { notFound } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function DonationStatus({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [donation] =
    await db()`SELECT id,amount,status,created_at FROM donations WHERE id=${id.data}`;
  if (!donation) notFound();
  return (
    <main className="wrap section">
      <p className="eyebrow">SYMPHONY OF FAITH / DONASI</p>
      <h1>Status kontribusi Anda.</h1>
      <div className="panel" style={{ maxWidth: 640 }}>
        <p>Referensi: {donation.id}</p>
        <h2>Rp{Number(donation.amount).toLocaleString("id-ID")}</h2>
        <p>
          Status: <strong>{donation.status}</strong>
        </p>
        <p>
          {donation.status === "VERIFIED"
            ? "Transfer telah diverifikasi dan tercatat sebagai dana diterima."
            : donation.status === "PENDING"
              ? "Referensi transfer tercatat. Petugas akan memeriksa mutasi rekening sebelum menghitung donasi ini."
              : "Donasi belum terverifikasi. Hubungi penyelenggara melalui kanal resmi jika Anda telah transfer."}
        </p>
      </div>
      <p>Simpan alamat halaman ini untuk memeriksa status.</p>
      <Link href="/">Kembali ke beranda ↗</Link>
    </main>
  );
}
