"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tickets = [
  { name: "VIP", price: 350000, description: "Pengalaman terdekat dengan panggung" },
  { name: "Festival", price: 200000, description: "Nikmati konser dari area festival" },
  { name: "Regular", price: 125000, description: "Hadir langsung di venue" },
  { name: "Online Pass", price: 50000, description: "Tonton siaran dari rumah" },
];
const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export default function Concert() {
  const [quantities, setQuantities] = useState([0, 0, 0, 0]);
  const [gift, setGift] = useState(0);
  const [donation, setDonation] = useState(100000);
  const [raised, setRaised] = useState(0);
  const [orders, setOrders] = useState<string[]>([]);
  const [dark, setDark] = useState(false);
  const [notice, setNotice] = useState("");
  const count = quantities.reduce((sum, quantity) => sum + quantity, 0);
  const total = tickets.reduce((sum, ticket, index) => sum + ticket.price * quantities[index], gift);

  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const prefersDark = localStorage.getItem("concert-theme") === "dark" ||
        (localStorage.getItem("concert-theme") === null && system.matches);
      document.documentElement.classList.toggle("dark", prefersDark);
      setDark(prefersDark);
    };
    sync();
    system.addEventListener("change", sync);
    return () => system.removeEventListener("change", sync);
  }, []);

  function changeQuantity(index: number, delta: number) {
    setQuantities(current => current.map((quantity, i) => i === index ? Math.max(0, quantity + delta) : quantity));
  }

  function checkout() {
    if (!count) return;
    setOrders(current => [...current, tickets.flatMap((ticket, i) =>
      quantities[i] ? [`${ticket.name} × ${quantities[i]}`] : []).join(", ")]);
    setRaised(current => current + gift);
    setQuantities([0, 0, 0, 0]);
    setGift(0);
    setNotice("Pesanan simulasi tercatat di Tiket Saya.");
  }

  return <>
    <header className="wrap top">
      <a className="wordmark" href="#beranda">Symphony of Faith</a>
      <nav aria-label="Navigasi utama"><a href="#tentang">Tentang</a><a href="#tiket">Tiket</a><a href="#donasi">Donasi</a><a href="#akses">Tiket Saya & Live</a></nav>
      <Button variant="outline" aria-pressed={dark} onClick={() => {
        localStorage.setItem("concert-theme", dark ? "light" : "dark");
        document.documentElement.classList.toggle("dark", !dark);
        setDark(!dark);
      }}>Mode gelap</Button>
    </header>
    <main id="beranda">
      <section className="stage">
        <div className="wrap stage-inner">
          <p className="kicker">Konser amal · Demo</p>
          <h1>Symphony<br />of <em>Faith.</em></h1>
          <p>Ketika musik menjadi doa, dan setiap nada membawa harapan bagi sesama.</p>
          <a className="stage-link" href="#tiket">Lihat pilihan tiket</a>
        </div>
      </section>
      <div className="wrap facts"><p><strong>Lokasi</strong> Akan diumumkan</p><p><strong>Jadwal</strong> Akan diumumkan</p><p>Harga dan transaksi di halaman ini adalah simulasi.</p></div>
      <section className="wrap section split" id="tentang">
        <h2>Tentang konser</h2>
        <p>Symphony of Faith mempertemukan musik, iman, dan kepedulian dalam konser amal. Anda dapat memilih hadir di venue atau mengikuti siaran dari rumah.</p>
      </section>
      <section className="wrap section" id="tiket">
        <h2>Pilih cara menikmati konser</h2>
        <p>Gabungkan beberapa kelas tiket dalam satu pesanan.</p>
        <div className="split">
          <div className="ticket-list">{tickets.map((ticket, i) =>
            <Card className="ticket-row" key={ticket.name}>
              <div><h3>{ticket.name}</h3><p>{ticket.description}</p><strong className="amount">{rupiah.format(ticket.price)}</strong></div>
              <div className="stepper">
                <Button variant="outline" aria-label={`Kurangi ${ticket.name}`} disabled={!quantities[i]} onClick={() => changeQuantity(i, -1)}>−</Button>
                <output aria-label={`Jumlah ${ticket.name}`}>{quantities[i]}</output>
                <Button variant="outline" aria-label={`Tambah ${ticket.name}`} onClick={() => changeQuantity(i, 1)}>+</Button>
              </div>
            </Card>)}</div>
          <Card className="panel"><h3>Ringkasan pesanan</h3>
            {count ? <ul>{tickets.map((ticket, i) => quantities[i] > 0 && <li key={ticket.name}>{ticket.name} × {quantities[i]}</li>)}</ul> : <p>Belum ada tiket dipilih.</p>}
            <label htmlFor="gift">Donasi sukarela (Rp)</label>
            <input id="gift" type="number" min="0" max="100000000" value={gift} onChange={event => setGift(Math.min(100000000, Math.max(0, Number(event.target.value))))} />
            <div className="total"><span>Total</span><strong className="amount">{rupiah.format(total)}</strong></div>
            <Button disabled={!count} onClick={checkout}>Simulasikan pembayaran</Button>
            <p role="status">{notice}</p>
          </Card>
        </div>
      </section>
      <section className="giving" id="donasi"><div className="wrap section split">
        <div><h2>Beri dukungan</h2><p>Anda bisa berdonasi tanpa membeli tiket konser.</p></div>
        <Card className="panel">
          <h3>Donasi konser amal</h3>
          <p role="status">Total simulasi: <strong className="amount">{rupiah.format(raised)}</strong></p>
          <form onSubmit={event => { event.preventDefault(); setRaised(current => current + donation); }}>
            <label htmlFor="donation">Nominal donasi (Rp)</label>
            <input id="donation" type="number" required min="10000" max="100000000" value={donation || ""} onChange={event => setDonation(Number(event.target.value))} />
            <Button type="submit">Simulasikan donasi</Button>
          </form>
        </Card>
      </div></section>
      <section className="wrap section" id="akses">
        <h2>Akses konser</h2>
        <Tabs defaultValue="tiket">
          <TabsList><TabsTrigger value="tiket">Tiket Saya</TabsTrigger><TabsTrigger value="live">Livestream</TabsTrigger></TabsList>
          <TabsContent value="tiket"><Card className="panel"><h3>Pesanan demo</h3>{orders.length ? <ul>{orders.map((order, i) => <li key={i}>{order}</li>)}</ul> : <p>Belum ada pesanan. Selesaikan simulasi pembayaran untuk melihat tiket di sini.</p>}</Card></TabsContent>
          <TabsContent value="live"><Card className="panel"><h3>Livestream</h3><p>{orders.length ? "Akses demo terbuka. Siaran belum tersedia." : "Selesaikan simulasi pembelian tiket untuk membuka akses demo."}</p></Card></TabsContent>
        </Tabs>
      </section>
    </main>
    <footer className="wrap footer">Symphony of Faith · Demo konser amal</footer>
  </>;
}
