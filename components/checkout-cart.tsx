"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { reserve } from "@/app/actions";
import { useCart } from "@/lib/cart";
import { formatRupiah, type Locale } from "@/lib/locale-format";
import { Minus, Plus, ArrowRight } from "lucide-react";

type Option = {
  id: string;
  name: string;
  mode: "VENUE" | "LIVESTREAM";
  price: number;
  available: number;
  active: boolean;
};
function Submit({ locale }: { locale: Locale }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending
        ? locale === "id"
          ? "Memproses…"
          : "Processing…"
        : locale === "id"
          ? "Buat reservasi"
          : "Reserve tickets"}
      <ArrowRight size={17} />
    </button>
  );
}
export function CheckoutCart({
  options,
  locale,
  authenticated,
  idempotencyKey,
}: {
  options: Option[];
  locale: Locale;
  authenticated: boolean;
  idempotencyKey: string;
}) {
  const [cart, setCart] = useCart();
  const selected = options.filter((option) => cart[option.id] > 0);
  const stale = selected.some(
    (option) =>
      !option.active || cart[option.id] > Math.min(option.available, 10),
  );
  const total = selected.reduce(
    (sum, option) => sum + cart[option.id] * option.price,
    0,
  );
  function change(id: string, delta: number, max: number) {
    setCart((current) => {
      const next = { ...current };
      const quantity = Math.max(0, Math.min(max, (current[id] ?? 0) + delta));
      if (quantity) next[id] = quantity;
      else delete next[id];
      return next;
    });
  }
  if (!selected.length)
    return (
      <div className="checkout-empty">
        <p>
          {locale === "id" ? "Keranjang masih kosong." : "Your cart is empty."}
        </p>
        <Link href="/#tickets">
          {locale === "id" ? "Pilih tiket" : "Choose tickets"}
        </Link>
      </div>
    );
  return (
    <div className="checkout-grid">
      <div className="checkout-list">
        <h2>{locale === "id" ? "Tiket pilihan Anda" : "Your tickets"}</h2>
        {selected.map((option) => (
          <div className="checkout-item" key={option.id}>
            <div>
              <h3>{option.name}</h3>
              <p>
                {option.mode === "VENUE"
                  ? locale === "id"
                    ? "Hadir langsung"
                    : "In person"
                  : "Livestream"}
              </p>
              {!option.active && (
                <p className="checkout-warning">
                  {locale === "id"
                    ? "Tiket ini tidak tersedia lagi."
                    : "This ticket is no longer available."}
                </p>
              )}
            </div>
            <div className="checkout-item-end">
              <strong>{formatRupiah(option.price * cart[option.id])}</strong>
              <div className="quantity-control">
                <button
                  type="button"
                  onClick={() => change(option.id, -1, 10)}
                  aria-label={`− ${option.name}`}
                >
                  <Minus size={15} />
                </button>
                <output>{cart[option.id]}</output>
                <button
                  type="button"
                  onClick={() =>
                    change(option.id, 1, Math.min(10, option.available))
                  }
                  disabled={
                    !option.active ||
                    cart[option.id] >= Math.min(10, option.available)
                  }
                  aria-label={`+ ${option.name}`}
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
        <Link className="back-link" href="/#tickets">
          {locale === "id" ? "Ubah pilihan tiket" : "Edit ticket selection"}
        </Link>
      </div>
      <aside className="checkout-summary">
        <h2>{locale === "id" ? "Ringkasan" : "Summary"}</h2>
        {selected.map((option) => (
          <div className="summary-line" key={option.id}>
            <span>
              {cart[option.id]} × {option.name}
            </span>
            <strong>{formatRupiah(option.price * cart[option.id])}</strong>
          </div>
        ))}
        <div className="summary-line">
          <span>{locale === "id" ? "Biaya tambahan" : "Additional fees"}</span>
          <strong>{formatRupiah(0)}</strong>
        </div>
        <div className="summary-total">
          <span>Total</span>
          <strong>{formatRupiah(total)}</strong>
        </div>
        <p>
          {locale === "id"
            ? "Harga akhir diverifikasi ulang oleh server. Pembayaran melalui transfer bank dan diperiksa petugas."
            : "The server rechecks the final price. Bank transfers are reviewed by staff."}
        </p>
        {stale && (
          <p className="checkout-warning">
            {locale === "id"
              ? "Pilihan berubah. Hapus atau sesuaikan tiket yang tidak tersedia."
              : "Your selection changed. Remove or adjust unavailable tickets."}
          </p>
        )}
        {authenticated ? (
          <form action={reserve}>
            <input
              type="hidden"
              name="items"
              value={JSON.stringify(
                selected.map((option) => ({
                  classId: option.id,
                  quantity: cart[option.id],
                })),
              )}
            />
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            <fieldset disabled={stale}>
              <Submit locale={locale} />
            </fieldset>
          </form>
        ) : (
          <Link className="checkout-auth" href="/login?next=checkout">
            {locale === "id"
              ? "Masuk atau daftar untuk melanjutkan"
              : "Sign in or register to continue"}
            <ArrowRight size={16} />
          </Link>
        )}
      </aside>
    </div>
  );
}
