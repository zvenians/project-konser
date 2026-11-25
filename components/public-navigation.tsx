"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import type { Locale } from "@/lib/i18n";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  return (
    <div
      className="language-switch"
      aria-label={locale === "id" ? "Bahasa" : "Language"}
    >
      {(["id", "en"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-current={locale === value ? "true" : undefined}
          onClick={() => {
            document.cookie = `sof_locale=${value}; path=/; max-age=31536000; samesite=lax`;
            window.location.reload();
          }}
        >
          {value.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function PublicNavigation({ locale = "id" }: { locale?: Locale }) {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/#tickets", label: locale === "id" ? "Tiket" : "Tickets" },
    {
      href: "/#information",
      label: locale === "id" ? "Informasi" : "Information",
    },
    { href: "/#venue", label: locale === "id" ? "Lokasi" : "Venue" },
  ];
  return (
    <header className="event-nav">
      <div className="event-nav-inner">
        <Link href="/" className="event-brand" aria-label="Symphony of Faith">
          <Image
            src="/brand/sof-gold-logo.png"
            alt=""
            width={52}
            height={52}
            priority
          />
          <span>Symphony of Faith</span>
        </Link>
        <nav
          className="event-nav-links"
          aria-label={locale === "id" ? "Navigasi utama" : "Main navigation"}
        >
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="event-nav-actions">
          <LanguageSwitcher locale={locale} />
          <Link className="nav-account" href="/claim-ticket">
            {locale === "id" ? "Claim Ticket" : "Claim Ticket"}
          </Link>
          <Link className="nav-buy" href="/#tickets">
            {locale === "id" ? "Beli tiket" : "Get tickets"}
          </Link>
          <button
            className="nav-menu-button"
            type="button"
            aria-expanded={open}
            aria-controls="event-mobile-nav"
            aria-label={
              open
                ? locale === "id"
                  ? "Tutup menu"
                  : "Close menu"
                : locale === "id"
                  ? "Buka menu"
                  : "Open menu"
            }
            onClick={() => setOpen(!open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="event-mobile-nav"
            className="event-mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {links.map((link) => (
              <Link
                href={link.href}
                key={link.href}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/claim-ticket">
              Claim Ticket
            </Link>
            <LanguageSwitcher locale={locale} />
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
