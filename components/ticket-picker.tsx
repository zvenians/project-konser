"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Minus, Plus, X, ArrowRight, Info } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatRupiah, type Locale } from "@/lib/locale-format";

export type TicketOption = {
  id: string;
  name: string;
  mode: "VENUE" | "LIVESTREAM";
  price: number;
  capacity: number | null;
  available: number;
  active: boolean;
  soldOut: boolean;
};

export function TicketPicker({
  options,
  cartOptions = options,
  showCart = true,
  locale,
}: {
  options: TicketOption[];
  cartOptions?: TicketOption[];
  showCart?: boolean;
  locale: Locale;
}) {
  const [mode, setMode] = useState<"VENUE" | "LIVESTREAM">(
    options[0]?.mode ?? "VENUE",
  );
  const [cart, setCart] = useCart();
  const [detail, setDetail] = useState<TicketOption | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (detail) dialog.current?.showModal();
    else dialog.current?.close();
  }, [detail]);
  const t =
    locale === "id"
      ? {
          title: "Pilih tiket",
          venue: "Hadir langsung",
          stream: "Livestream",
          info: "Detail tiket",
          available: "tersedia",
          unavailable: "Belum tersedia",
          sold: "Habis",
          quantity: "Jumlah",
          summary: "Ringkasan pesanan",
          empty: "Belum ada tiket dipilih",
          total: "Total",
          fee: "Biaya tambahan",
          noFee: "Tidak ada",
          checkout: "Lanjut ke checkout",
          access: "Akses masuk ke venue pada 7 Februari 2027.",
          streamAccess:
            "Akses livestream diberikan setelah pembayaran diverifikasi dan siaran diaktifkan.",
          limit: "Maksimum 10 tiket per jenis dalam satu pesanan.",
          close: "Tutup",
          note: "Harga dan stok dikonfirmasi kembali saat reservasi.",
        }
      : {
          title: "Choose tickets",
          venue: "In person",
          stream: "Livestream",
          info: "Ticket details",
          available: "available",
          unavailable: "Not available yet",
          sold: "Sold out",
          quantity: "Quantity",
          summary: "Order summary",
          empty: "No tickets selected",
          total: "Total",
          fee: "Additional fees",
          noFee: "None",
          checkout: "Continue to checkout",
          access: "Venue entry on February 7, 2027.",
          streamAccess:
            "Livestream access is granted after payment verification and stream activation.",
          limit: "Maximum 10 tickets per type in one order.",
          close: "Close",
          note: "Price and availability are confirmed when you reserve.",
        };
  const rows = options.filter((option) => option.mode === mode);
  const selected = cartOptions.filter((option) => cart[option.id] > 0);
  const total = selected.reduce(
    (sum, option) => sum + option.price * cart[option.id],
    0,
  );
  const count = selected.reduce((sum, option) => sum + cart[option.id], 0);
  function change(option: TicketOption, delta: number) {
    if (!option.active) return;
    setCart((current) => {
      const next = Math.max(
        0,
        Math.min(10, option.available, (current[option.id] ?? 0) + delta),
      );
      const updated = { ...current };
      if (next) updated[option.id] = next;
      else delete updated[option.id];
      return updated;
    });
  }
  return (
    <div className="picker-layout">
      <div className="picker-main">
        <div className="picker-heading">
          <h2>{t.title}</h2>
          <span>{options.length} {locale === "id" ? "pilihan" : "options"}</span>
        </div>
        {new Set(options.map((option) => option.mode)).size > 1 && <div className="picker-tabs" role="tablist" aria-label={t.title}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "VENUE"}
            onClick={() => setMode("VENUE")}
          >
            {t.venue}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "LIVESTREAM"}
            onClick={() => setMode("LIVESTREAM")}
          >
            {t.stream}
          </button>
        </div>}
        <div className="picker-rows">
          {rows.map((option) => {
            const quantity = cart[option.id] ?? 0;
            return (
              <article
                className={`picker-row ${option.active ? "active" : ""} ${quantity ? "selected" : ""}`}
                key={option.id}
              >
                <div className="picker-row-text">
                  <div className="picker-row-name">
                    <h3>{option.name}</h3>
                    <button
                      type="button"
                      className="info-button"
                      onClick={() => setDetail(option)}
                      aria-label={`${t.info}: ${option.name}`}
                    >
                      <Info size={16} />
                    </button>
                  </div>
                  <p>
                    {option.mode === "VENUE" ? t.venue : t.stream} ·{" "}
                    {option.active
                      ? option.capacity === null ? t.available : `${option.available} ${t.available}`
                      : option.soldOut
                        ? t.sold
                        : t.unavailable}
                  </p>
                </div>
                <div className="picker-row-action">
                  <strong>{formatRupiah(option.price)}</strong>
                  {option.active ? (
                    <div
                      className="quantity-control"
                      aria-label={`${t.quantity} ${option.name}`}
                    >
                      <button
                        type="button"
                        onClick={() => change(option, -1)}
                        disabled={!quantity}
                        aria-label={`− ${option.name}`}
                      >
                        <Minus size={16} />
                      </button>
                      <motion.output
                        key={quantity}
                        initial={{ scale: 0.85, opacity: 0.5 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.15 }}
                      >
                        {quantity}
                      </motion.output>
                      <button
                        type="button"
                        onClick={() => change(option, 1)}
                        disabled={quantity >= Math.min(10, option.available)}
                        aria-label={`+ ${option.name}`}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ) : (
                    <span className="ticket-unavailable">
                      {option.soldOut ? t.sold : t.unavailable}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <p className="picker-disclaimer">{t.note}</p>
      </div>
      {showCart && count > 0 && (
        <aside className="cart-panel" aria-live="polite">
          <h3>{t.summary}</h3>
          {selected.length ? (
            <ul>
              {selected.map((option) => (
                <li key={option.id}>
                  <span>
                    {cart[option.id]} × {option.name}
                    <small>
                      {option.mode === "VENUE" ? t.venue : t.stream}
                    </small>
                  </span>
                  <strong>
                    {formatRupiah(option.price * cart[option.id])}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cart-empty">{t.empty}</p>
          )}
          <div className="cart-fee">
            <span>{t.fee}</span>
            <span>{t.noFee}</span>
          </div>
          <div className="cart-total">
            <span>{t.total}</span>
            <strong>{formatRupiah(total)}</strong>
          </div>
          <Link className="checkout-button" href="/checkout">
            {t.checkout}
            <ArrowRight size={18} />
          </Link>
        </aside>
      )}
      <AnimatePresence>
        {showCart && count > 0 && (
          <motion.div
            className="mobile-cart-bar"
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ duration: 0.2 }}
          >
            <span>
              {count} {locale === "id" ? "tiket" : "tickets"}
              <strong>{formatRupiah(total)}</strong>
            </span>
            <Link href="/checkout">
              Checkout
              <ArrowRight size={17} />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
      <dialog
        ref={dialog}
        className="ticket-dialog"
        onClose={() => setDetail(null)}
      >
        {detail && (
          <>
            <div className="dialog-head">
              <h3>{detail.name}</h3>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label={t.close}
              >
                <X size={20} />
              </button>
            </div>
            <p className="dialog-price">{formatRupiah(detail.price)}</p>
            <p>{detail.mode === "VENUE" ? t.venue : t.stream}</p>
            <p>{detail.mode === "VENUE" ? t.access : t.streamAccess}</p>
            {detail.capacity && (
              <p>
                {locale === "id" ? "Kapasitas resmi" : "Official capacity"}:{" "}
                {detail.capacity}
              </p>
            )}
            <p>{t.limit}</p>
          </>
        )}
      </dialog>
    </div>
  );
}
