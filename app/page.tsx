import { Countdown } from "@/components/countdown";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { event, officialClasses } from "@/lib/event";
import Image from "next/image";

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export default function Concert() {
  return <>
    <header className="wrap top"><a className="wordmark" href="#beranda"><Image src="/brand/sof-gold-logo.png" alt="Symphony of Faith" width={120} height={60} /></a><nav aria-label="Navigasi utama"><a href="#tentang">Tentang</a><a href="#tiket">Tiket</a><a href="#donasi">Donasi</a><a href="/login">Masuk</a><a href={event.instagram} target="_blank" rel="noopener noreferrer">Instagram</a></nav></header>
    <main id="beranda">
      <section className="stage"><div className="wrap stage-inner"><p className="kicker">Charity Concert · Medan</p><h1>Symphony<br />of <em>Faith.</em></h1><p>Minggu, 7 Februari 2027 · 19.00–22.00 WIB</p><p>{event.venue}</p><p>Satu malam penuh musik, dengan tujuan yang lebih besar.</p><a className="stage-link" href="#tiket">Lihat tiket</a><Countdown /></div></section>
      <section className="wrap section split" id="tentang"><h2>Musik dan kepedulian</h2><p>Symphony of Faith adalah konser amal di Tiara Convention Hall, Medan. Informasi program charity akan dipublikasikan oleh penyelenggara.</p></section>
      <section className="wrap section" id="tiket"><h2>Pilih caramu menikmati konser</h2><p>Minggu, 7 Februari 2027 · 19.00–22.00 WIB · {event.venue}</p>
        <Tabs defaultValue="venue"><TabsList><TabsTrigger value="venue">Hadir Langsung</TabsTrigger><TabsTrigger value="stream">Livestream</TabsTrigger></TabsList>
          {(["venue", "stream"] as const).map(mode => <TabsContent key={mode} value={mode}>
            <p>{mode === "venue" ? "Penjualan dibuka setelah tiket PDF asli selesai diverifikasi." : "Semua pilihan livestream menyediakan hak akses online yang sama. Penjualan menunggu kesiapan siaran."}</p>
            <div className="ticket-list">{officialClasses.map(ticket => <Card key={ticket.name} className="ticket-row"><div><h3>{ticket.name}</h3><strong className="amount">{rupiah.format(mode === "venue" ? ticket.venuePrice : ticket.streamPrice)}</strong></div><span>{mode === "venue" ? "Menunggu inventaris terverifikasi" : "Penjualan belum dibuka"}</span></Card>)}</div>
          </TabsContent>)}
        </Tabs>
      </section>
      <section className="giving" id="donasi"><div className="wrap section split"><h2>Dukung tujuan baik</h2><p>Informasi penerima, cara berdonasi, dan konfirmasi donasi sedang disiapkan oleh penyelenggara.</p></div></section>
    </main><footer className="wrap footer"><strong>Symphony of Faith</strong><p>Minggu, 7 Februari 2027 · 19.00–22.00 WIB</p><p>{event.venue}</p><a href={event.instagram} target="_blank" rel="noopener noreferrer">Instagram resmi</a></footer>
  </>;
}
