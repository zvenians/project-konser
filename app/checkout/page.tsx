import { randomUUID } from "node:crypto";
import Link from "next/link";
import { CheckoutCart } from "@/components/checkout-cart";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { settingValue } from "@/lib/settings";
import { demoModeEnabled } from "@/lib/demo-config";
import { ensureDemoData } from "@/lib/demo-data";

export const dynamic = "force-dynamic";
export default async function CheckoutPage() {
  const demo = demoModeEnabled();
  if (demo) await ensureDemoData();
  const locale = await getLocale();
  const [user, classes, settings] = await Promise.all([
    currentUser(),
    db()`SELECT c.id,c.name,c.mode,c.price,c.capacity,c.sale_enabled,e.streaming_ready,
      count(t.id) FILTER (WHERE t.status='AVAILABLE' AND t.is_demo=${demo})::integer AS venue_available,
      coalesce((SELECT sum(i.quantity)::integer FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.class_id=c.id AND o.is_demo=${demo} AND o.status IN ('PENDING','PAYMENT_REVIEW','CONFIRMED')),0) AS stream_reserved
      FROM ticket_classes c JOIN events e ON e.id=c.event_id LEFT JOIN ticket_inventory t ON t.class_id=c.id GROUP BY c.id,e.streaming_ready`,
    db()`SELECT value FROM site_settings WHERE key='payment_instructions'`,
  ]);
  const payment = settingValue<{
    bank: string;
    account: string;
    holder: string;
  }>(settings[0]?.value);
  const ready = demo || Boolean(payment?.bank && payment.account && payment.holder);
  const options = classes.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    mode: String(row.mode) as "VENUE" | "LIVESTREAM",
    price: Number(row.price),
    available: row.mode === "VENUE"
      ? Number(row.venue_available)
      : Math.max(0, Number(row.capacity) - Number(row.stream_reserved)),
    active:
      ready &&
      Boolean(row.sale_enabled) &&
      (row.mode === "VENUE"
        ? Number(row.venue_available) > 0
        : Boolean(row.streaming_ready) && Number(row.capacity) > Number(row.stream_reserved)),
  }));
  return (
    <>
      <main className="checkout-page event-container">
        <Link className="back-link" href="/#tickets">
          ← {locale === "id" ? "Kembali ke tiket" : "Back to tickets"}
        </Link>
        <h1>Checkout</h1>
        <p>
          {locale === "id"
            ? "Periksa pilihan sebelum membuat reservasi."
            : "Review your selection before reserving."}
        </p>
        <CheckoutCart
          options={options}
          locale={locale}
          authenticated={Boolean(user)}
          idempotencyKey={randomUUID()}
        />
      </main>
    </>
  );
}
