import { Countdown } from "@/components/countdown";
import {
  EditorialCard,
  HeroEntrance,
  SmoothScrollProvider,
  WordReveal,
} from "@/components/editorial-motion";
import { PublicNavigation } from "@/components/public-navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/db";
import { event, officialClasses } from "@/lib/event";
import { settingValue } from "@/lib/settings";

export const dynamic = "force-dynamic";
const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;

export default async function Concert() {
  const [classes, settings] = await Promise.all([
    db()`SELECT c.name,c.mode,c.price,c.capacity,c.sale_enabled,e.streaming_ready,count(t.id) FILTER(WHERE t.status='AVAILABLE')::integer AS available FROM ticket_classes c JOIN events e ON e.id=c.event_id LEFT JOIN ticket_inventory t ON t.class_id=c.id GROUP BY c.id,e.streaming_ready ORDER BY c.price DESC`,
    db()`SELECT value FROM site_settings WHERE key='payment_instructions'`,
  ]);
  const paymentReady = Boolean(
    settingValue<{ bank: string }>(settings[0]?.value)?.bank,
  );
  const ticketRows = (mode: "VENUE" | "LIVESTREAM") =>
    officialClasses.map((ticket) => {
      const row = classes.find(
        (c) => c.name === ticket.name && c.mode === mode,
      );
      const available = Number(row?.available ?? 0);
      const active =
        paymentReady &&
        Boolean(row?.sale_enabled) &&
        (mode === "VENUE" ? available > 0 : Boolean(row?.streaming_ready));
      return (
        <EditorialCard className="ticket-card" key={ticket.name}>
          <div className="ticket-card-top">
            <span className="ticket-index">
              {String(officialClasses.indexOf(ticket) + 1).padStart(2, "0")}
            </span>
            <span className={`ticket-state ${active ? "open" : ""}`}>
              {active
                ? "Tersedia"
                : mode === "VENUE"
                  ? "Menunggu PDF terverifikasi"
                  : "Belum dibuka"}
            </span>
          </div>
          <div className="ticket-card-main">
            <h3>{ticket.name}</h3>
            <strong>
              {money(mode === "VENUE" ? ticket.venuePrice : ticket.streamPrice)}
            </strong>
          </div>
          <div className="ticket-card-foot">
            <span>
              {mode === "VENUE"
                ? `${available} siap dari kapasitas ${ticket.capacity}`
                : "Akses siaran daring"}
            </span>
            {active ? (
              <a href="/account#booking">Pilih tiket ↗</a>
            ) : (
              <span aria-label="Penjualan belum dibuka">—</span>
            )}
          </div>
        </EditorialCard>
      );
    });
  const eventJson = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.startsAt,
    endDate: event.endsAt,
    eventAttendanceMode: "https://schema.org/MixedEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: event.venue,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Medan",
        addressCountry: "ID",
      },
    },
    organizer: {
      "@type": "Organization",
      name: event.title,
      url: "https://symphonyoffaith.vercel.app",
    },
  };
  return (
    <>
      <SmoothScrollProvider />
      <PublicNavigation />
      <main id="beranda">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJson) }}
        />
        <section className="hero">
          <div className="hero-architecture" aria-hidden="true">
            <div className="hero-arch arch-one" />
            <div className="hero-arch arch-two" />
            <div className="hero-sun" />
          </div>
          <div className="wrap hero-grid">
            <div className="hero-content">
              <HeroEntrance>
                <p className="eyebrow light">
                  CHARITY CONCERT <span>·</span> MEDAN 2027
                </p>
                <h1>
                  Symphony
                  <br />
                  of <em>Faith.</em>
                </h1>
                <p className="hero-subline">
                  Satu malam ketika musik, iman, dan kepedulian bertemu. Mari
                  hadir untuk sesuatu yang berarti.
                </p>
                <p className="hero-mobile-details">
                  Minggu, 7 Februari 2027 · 19.00–22.00 WIB
                  <br />
                  {event.venue}
                </p>
                <div className="hero-actions">
                  <a className="primary-action" href="#tiket">
                    Jelajahi tiket <span>↗</span>
                  </a>
                  <a className="quiet-action" href="#tentang">
                    Tentang konser <span>↓</span>
                  </a>
                </div>
                <div className="hero-mobile-countdown">
                  <span className="eyebrow light">MENUJU PERTUNJUKAN</span>
                  <Countdown />
                </div>
              </HeroEntrance>
            </div>
            <div className="hero-side">
              <p className="eyebrow light">SATU MALAM YANG BERARTI</p>
              <div className="hero-event">
                <strong>
                  07 <span>/</span> 02 <span>/</span> 27
                </strong>
                <p>
                  Minggu · 19.00–22.00 WIB
                  <br />
                  {event.venue}
                </p>
              </div>
              <div className="hero-countdown">
                <span className="eyebrow light">MENUJU PERTUNJUKAN</span>
                <Countdown />
              </div>
            </div>
          </div>
          <div className="hero-bottom wrap">
            <span>SCROLL UNTUK MENJELAJAHI</span>
            <span>01 — 06</span>
          </div>
        </section>
        <section id="tentang" className="about-section">
          <div className="wrap editorial-grid">
            <div className="section-aside">
              <span className="section-number">01 / THE IDEA</span>
              <div className="rule-ornament" aria-hidden />
            </div>
            <div className="section-copy">
              <WordReveal>Musik yang membawa kita lebih dekat.</WordReveal>
              <div className="copy-columns">
                <p className="lead">
                  Sebuah pertemuan di mana melodi dan tujuan baik berbagi satu
                  panggung.
                </p>
                <p>
                  Symphony of Faith adalah konser amal di Medan. Kami ingin
                  menghadirkan malam yang hangat untuk menikmati musik bersama
                  dan mengambil bagian dalam semangat kepedulian. Informasi
                  resmi mengenai program charity akan disampaikan oleh
                  penyelenggara.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section id="pengalaman" className="experience-section">
          <div className="wrap">
            <div className="section-heading">
              <p className="eyebrow">02 / THE EXPERIENCE</p>
              <WordReveal>Hadirlah dengan caramu sendiri.</WordReveal>
            </div>
            <div className="experience-grid">
              <EditorialCard className="experience-card venue">
                <div className="experience-art" aria-hidden>
                  <span className="sound-line l1" />
                  <span className="sound-line l2" />
                  <span className="sound-line l3" />
                  <span className="sound-line l4" />
                </div>
                <div className="experience-copy">
                  <span className="eyebrow light">01 / DI LOKASI</span>
                  <h3>Rasakan malamnya bersama.</h3>
                  <p>
                    Hadir langsung di Tiara Convention Hall, Medan, dan bagikan
                    pengalaman konser dengan orang-orang di sekelilingmu.
                  </p>
                  <a href="#tiket">Tiket venue ↗</a>
                </div>
              </EditorialCard>
              <EditorialCard className="experience-card stream">
                <div className="stream-art" aria-hidden>
                  <span>SOF</span>
                  <i />
                </div>
                <div className="experience-copy">
                  <span className="eyebrow">02 / DARI MANA SAJA</span>
                  <h3>Terhubung lewat siaran.</h3>
                  <p>
                    Livestream direncanakan untuk kamu yang ingin mengikuti
                    konser dari tempat lain. Akses dibuka setelah kesiapan
                    siaran dikonfirmasi.
                  </p>
                  <a href="#tiket">Tiket livestream ↗</a>
                </div>
              </EditorialCard>
            </div>
          </div>
        </section>
        <section id="tiket" className="tickets-section">
          <div className="wrap">
            <div className="tickets-intro">
              <div>
                <p className="eyebrow">03 / YOUR SEAT, YOUR MOMENT</p>
                <WordReveal>Pilih pengalaman konsermu.</WordReveal>
              </div>
              <p>
                Harga resmi untuk hadir langsung dan livestream. Pembelian
                dibuka setelah inventaris dan layanan pembayaran siap.
              </p>
            </div>
            <Tabs defaultValue="venue">
              <TabsList className="ticket-tabs">
                <TabsTrigger value="venue">
                  Hadir langsung <span>↗</span>
                </TabsTrigger>
                <TabsTrigger value="stream">
                  Livestream <span>↗</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="venue">
                <p className="ticket-note">
                  Kapasitas venue: 1.850 kursi. Hanya PDF asli yang telah
                  diverifikasi dapat dipesan.
                </p>
                <div className="ticket-grid">{ticketRows("VENUE")}</div>
              </TabsContent>
              <TabsContent value="stream">
                <p className="ticket-note">
                  Semua kelas livestream memberikan hak akses siaran yang sama.
                  Penjualan menunggu kesiapan platform siaran.
                </p>
                <div className="ticket-grid">{ticketRows("LIVESTREAM")}</div>
              </TabsContent>
            </Tabs>
          </div>
        </section>
        <section id="donasi" className="charity-section">
          <div className="wrap charity-grid">
            <div>
              <p className="eyebrow light">04 / THE PURPOSE</p>
              <WordReveal>Satu malam. Ruang untuk peduli.</WordReveal>
            </div>
            <div>
              <p>
                Kepedulian adalah bagian dari kisah Symphony of Faith.
                Kontribusi donasi dicatat terpisah dari pembelian tiket dan
                hanya dihitung setelah pembayaran diverifikasi.
              </p>
              {paymentReady ? (
                <a className="primary-action" href="/donate">
                  Lihat cara berdonasi ↗
                </a>
              ) : (
                <p className="charity-note">
                  Instruksi donasi resmi akan diumumkan setelah tersedia.
                </p>
              )}
            </div>
          </div>
        </section>
        <section className="faq-section">
          <div className="wrap faq-grid">
            <div>
              <p className="eyebrow">05 / NEED TO KNOW</p>
              <WordReveal>Sebelum kita bertemu.</WordReveal>
            </div>
            <div className="faq-list">
              <details>
                <summary>Kapan dan di mana konser berlangsung?</summary>
                <p>
                  Minggu, 7 Februari 2027, pukul 19.00–22.00 WIB di Tiara
                  Convention Hall, Medan.
                </p>
              </details>
              <details>
                <summary>Kapan tiket venue tersedia?</summary>
                <p>
                  Penjualan dibuka setelah PDF tiket asli diimpor dan
                  diverifikasi oleh penyelenggara. Ketersediaan ditampilkan pada
                  pilihan kelas di atas.
                </p>
              </details>
              <details>
                <summary>Kapan saya mendapatkan PDF tiket?</summary>
                <p>
                  PDF tiket asli dapat diunduh dari akun setelah pembayaran
                  diverifikasi oleh petugas.
                </p>
              </details>
              <details>
                <summary>Bagaimana akses livestream diberikan?</summary>
                <p>
                  Akses hanya diberikan kepada akun dengan pesanan livestream
                  yang telah dibayar dan diverifikasi. Siaran tersedia setelah
                  penyelenggara mengaktifkan layanan.
                </p>
              </details>
            </div>
          </div>
        </section>
        <section className="closing-section">
          <div className="wrap closing-content">
            <p className="eyebrow light">06 / THE INVITATION</p>
            <WordReveal>Mari hadir untuk sesuatu yang berarti.</WordReveal>
            <a className="primary-action" href="#tiket">
              Lihat pilihan tiket ↗
            </a>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div>
            <strong>Symphony of Faith</strong>
            <p>7 Februari 2027 · Tiara Convention Hall, Medan</p>
          </div>
          <div>
            <a href="#beranda">Kembali ke atas ↑</a>
            <a href="/account">Akun saya</a>
            <a href={event.instagram} target="_blank" rel="noopener noreferrer">
              Instagram resmi ↗
            </a>
          </div>
        </div>
        <div className="wrap footer-end">
          <span>© 2026 Symphony of Faith</span>
          <span>Konser amal · Medan</span>
        </div>
      </footer>
    </>
  );
}
