"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";

const links = [
  { href: "#tentang", label: "Tentang" },
  { href: "#pengalaman", label: "Pengalaman" },
  { href: "#tiket", label: "Tiket" },
  { href: "#donasi", label: "Donasi" },
];

export function PublicNavigation() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <header className={`public-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="wrap nav-inner">
        <a
          href="#beranda"
          aria-label="Symphony of Faith, beranda"
          onClick={() => setOpen(false)}
        >
          <Image
            src="/brand/sof-gold-logo.png"
            alt=""
            width={116}
            height={58}
            priority
          />
        </a>
        <nav className="desktop-nav" aria-label="Navigasi utama">
          {links.map((link) => (
            <a href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <a className="account-link" href="/account">
            Akun
          </a>
          <a className="nav-ticket" href="#tiket">
            Lihat tiket <span aria-hidden>↗</span>
          </a>
          <button
            className="menu-toggle"
            type="button"
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(!open)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            className="mobile-nav"
            aria-label="Navigasi seluler"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {links.map((link) => (
              <a
                href={link.href}
                key={link.href}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a href="/account">Akun saya</a>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
