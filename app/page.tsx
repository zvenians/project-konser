import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  Clock3,
  Share2,
  ArrowUpRight,
} from "lucide-react";
import { TicketPicker, type TicketOption } from "@/components/ticket-picker";
import { ShareButton } from "@/components/share-button";
import { EventMotion } from "@/components/event-motion";
import { db } from "@/lib/db";
import { contributionTiers, event, livestreamPackages, venueClasses } from "@/lib/event";
import { getLocale, formatEventDate, translate } from "@/lib/i18n";
import { settingValue } from "@/lib/settings";
import { demoModeEnabled } from "@/lib/demo-config";
import { ensureDemoData } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

const messages = {
  id: {
    by: "Oleh",
    date: "Tanggal",
    time: "Waktu",
    venue: "Lokasi",
    tickets: "Lihat tiket",
    venueTickets: "Tiket venue",
    venueTicketsText: "Pilih kursi untuk hadir langsung di Tiara Convention Hall.",
    livestreamPackages: "Paket livestream",
    livestreamPackagesText: "Nikmati siaran konser dari mana saja dengan akses digital terpisah.",
    contributionProgram: "Program kontribusi",
    contributionProgramText: "Dukung karya dan pelayanan melalui kontribusi yang terpisah dari pembelian tiket.",
    share: "Bagikan",
    about: "Tentang acara",
    aboutText:
      "Symphony of Faith adalah konser amal di Medan yang mempertemukan musik, iman, dan kepedulian. Informasi resmi mengenai program amal akan disampaikan oleh penyelenggara.",
    details: "Informasi acara",
    ticketInfo:
      "Tiket venue diterbitkan setelah pembayaran diverifikasi. Tiket livestream memberikan akses siaran setelah penyelenggara mengaktifkannya.",
    venueInfo: "Lokasi",
    directions: "Buka peta",
    organizer: "Penyelenggara",
    contact: "Instagram resmi",
    policies: "Kebijakan",
    policyText:
      "Ketentuan pengembalian dana, pemindahan tiket, dan aksesibilitas menunggu konfirmasi resmi penyelenggara.",
    donate: "Donasi",
    donateText:
      "Donasi dicatat terpisah dari pembelian tiket dan diverifikasi sebelum diakui.",
    donateAction: "Lihat donasi",
    account: "Akun saya",
  },
  en: {
    by: "By",
    date: "Date",
    time: "Time",
    venue: "Venue",
    tickets: "View tickets",
    venueTickets: "Venue tickets",
    venueTicketsText: "Choose your seat for an in-person experience at Tiara Convention Hall.",
    livestreamPackages: "Livestream packages",
    livestreamPackagesText: "Join the concert from anywhere with separate digital access.",
    contributionProgram: "Contribution program",
    contributionProgramText: "Support the work and ministry through a contribution separate from ticket purchases.",
    share: "Share",
    about: "About the event",
    aboutText:
      "Symphony of Faith is a charity concert in Medan bringing together music, faith, and care. The organizer will publish official information about the charitable program.",
    details: "Event information",
    ticketInfo:
      "Venue tickets are issued after payment verification. Livestream tickets grant access when the organizer activates the broadcast.",
    venueInfo: "Location",
    directions: "Open map",
    organizer: "Organizer",
    contact: "Official Instagram",
    policies: "Policies",
    policyText:
      "Refund, ticket transfer, and accessibility terms are awaiting official organizer confirmation.",
    donate: "Donations",
    donateText:
      "Donations are recorded separately from ticket purchases and verified before recognition.",
    donateAction: "View donations",
    account: "My account",
  },
};

export default async function EventPage() {
  const demo = demoModeEnabled();
  if (demo) await ensureDemoData();
  const locale = await getLocale();
  const t = translate(locale, messages);
  const [classes, settings] = await Promise.all([
    db()`SELECT c.id,c.name,c.mode,c.price,c.capacity,c.sale_enabled,e.streaming_ready,
      count(t.id) FILTER(WHERE t.status='AVAILABLE' AND t.is_demo=${demo})::integer AS venue_available,
      coalesce((SELECT sum(i.quantity)::integer FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.class_id=c.id AND o.is_demo=${demo} AND o.status IN ('PENDING','PAYMENT_REVIEW','CONFIRMED')),0) AS stream_reserved
      FROM ticket_classes c JOIN events e ON e.id=c.event_id LEFT JOIN ticket_inventory t ON t.class_id=c.id GROUP BY c.id,e.streaming_ready ORDER BY c.price DESC`,
    db()`SELECT value FROM site_settings WHERE key='payment_instructions'`,
  ]);
  const payment = settingValue<{
    bank: string;
    account: string;
    holder: string;
  }>(settings[0]?.value);
  const paymentReady =
    demo || Boolean(payment?.bank && payment.account && payment.holder);
  const optionsFor = (mode: "VENUE" | "LIVESTREAM", catalogue: ReadonlyArray<{ name: string; price: number; capacity?: number }>): TicketOption[] =>
    catalogue.map((item) => {
        const row = classes.find(
          (c) => c.name === item.name && c.mode === mode,
        );
        const capacity = mode === "VENUE" ? item.capacity ?? 0 : Number(row?.capacity ?? 0);
        const available = mode === "VENUE"
          ? Number(row?.venue_available ?? 0)
          : Math.max(0, capacity - Number(row?.stream_reserved ?? 0));
        return {
          id: String(row?.id ?? ""),
          name: item.name,
          mode,
          price: Number(row?.price ?? item.price),
          capacity,
          available,
          active:
            paymentReady &&
            Boolean(row?.sale_enabled) &&
            available > 0 && (mode === "VENUE" || Boolean(row?.streaming_ready)),
          soldOut: paymentReady && Boolean(row?.sale_enabled) && available === 0,
        };
    });
  const venueOptions = optionsFor("VENUE", venueClasses);
  const streamOptions = optionsFor("LIVESTREAM", livestreamPackages);
  return (
    <>
      <EventMotion />
      <main className="event-page">
        <div className="event-backdrop" />
        <div className="event-container">
          <div className="event-breadcrumb">
            <Link href="/">Symphony of Faith</Link>
            <span>/</span>
            <span>Medan 2027</span>
          </div>
          <section className="event-hero" aria-labelledby="event-title">
            <div className="event-cover">
              <picture>
                <source
                  media="(max-width: 700px)"
                  srcSet="/brand/church-hero-mobile.webp"
                />
                <Image
                  src="/brand/church-hero-desktop.webp"
                  alt="Perspektif eksterior Gereja Advent Karo"
                  fill
                  priority
                  sizes="(max-width: 700px) calc(100vw - 32px), min(1232px, calc(100vw - 48px))"
                />
              </picture>
            </div>
            <div className="event-identity">
              <span className="event-type">CHARITY CONCERT · MEDAN</span>
              <h1 id="event-title">
                Symphony
                <br />
                of Faith
              </h1>
              <p className="event-byline">
                {t.by}{" "}
                <a
                  href={event.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Symphony of Faith <ArrowUpRight size={14} />
                </a>
              </p>
              <div className="event-facts">
                <div>
                  <CalendarDays size={19} />
                  <span>
                    <small>{t.date}</small>
                    <strong>{formatEventDate(locale)}</strong>
                  </span>
                </div>
                <div>
                  <Clock3 size={19} />
                  <span>
                    <small>{t.time}</small>
                    <strong>19:00–22:00 WIB</strong>
                  </span>
                </div>
                <div>
                  <MapPin size={19} />
                  <span>
                    <small>{t.venue}</small>
                    <strong>Tiara Convention Hall, Medan</strong>
                  </span>
                </div>
              </div>
              <div className="event-actions">
                <a className="event-cta" href="#tickets">
                  {t.tickets}
                </a>
                <ShareButton locale={locale} />
              </div>
            </div>
          </section>
          <section id="tickets" className="event-tickets product-section">
            <div className="product-section-intro">
              <p className="eyebrow">01 / {t.venueTickets}</p>
              <h2>{t.venueTickets}</h2>
              <p>{t.venueTicketsText}</p>
            </div>
            <TicketPicker options={venueOptions} locale={locale} />
          </section>
          <section id="livestream" className="event-tickets product-section">
            <div className="product-section-intro">
              <p className="eyebrow">02 / LIVESTREAM</p>
              <h2>{t.livestreamPackages}</h2>
              <p>{t.livestreamPackagesText}</p>
            </div>
            <TicketPicker options={streamOptions} locale={locale} />
          </section>
          <section id="contributions" className="contribution-section">
            <div className="product-section-intro">
              <p className="eyebrow">03 / {t.donate}</p>
              <h2>{t.contributionProgram}</h2>
              <p>{t.contributionProgramText}</p>
            </div>
            <div className="contribution-tier-grid">
              {contributionTiers.map((tier) => (
                <Link href={`/donate?tier=${encodeURIComponent(tier.name)}`} className="contribution-tier" key={tier.name}>
                  <span>{tier.name}</span>
                  <strong>Rp{tier.price.toLocaleString("id-ID")}</strong>
                </Link>
              ))}
            </div>
            <Link href="/donate" className="event-cta">{t.donateAction}</Link>
          </section>
          <div className="event-lower">
            <section id="information" className="event-info">
              <h2>{t.about}</h2>
              <p>{t.aboutText}</p>
              <h3>{t.details}</h3>
              <p>{t.ticketInfo}</p>
              <h3>{t.policies}</h3>
              <p>{t.policyText}</p>
            </section>
            <aside className="event-side-info">
              <section id="venue">
                <h2>{t.venueInfo}</h2>
                <strong>Tiara Convention Hall</strong>
                <p>Medan, Indonesia</p>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Tiara+Convention+Hall+Medan"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.directions} <ArrowUpRight size={15} />
                </a>
              </section>
              <section>
                <h2>{t.organizer}</h2>
                <strong>Symphony of Faith</strong>
                <a
                  href={event.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.contact} <ArrowUpRight size={15} />
                </a>
              </section>
              <section>
                <h2>{t.donate}</h2>
                <p>{t.donateText}</p>
                <a href="/donate">
                  {t.donateAction} <ArrowUpRight size={15} />
                </a>
              </section>
            </aside>
          </div>
        </div>
      </main>
      <footer className="event-footer">
        <div className="event-container">
          <span>© 2026 Symphony of Faith</span>
          <a href="/account">{t.account}</a>
          <a href={event.instagram} target="_blank" rel="noopener noreferrer">
            Instagram <Share2 size={14} />
          </a>
        </div>
      </footer>
    </>
  );
}
