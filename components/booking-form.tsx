"use client";

import { useState } from "react";
import { reserve } from "@/app/actions";

type TicketClass = {
  id: string;
  name: string;
  mode: string;
  price: number;
  available: number;
};
export function BookingForm({
  classes,
  idempotencyKey,
}: {
  classes: TicketClass[];
  idempotencyKey: string;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const items = classes
    .filter((item) => quantities[item.id] > 0)
    .map((item) => ({ classId: item.id, quantity: quantities[item.id] }));
  const total = classes.reduce(
    (sum, item) => sum + item.price * (quantities[item.id] ?? 0),
    0,
  );
  return (
    <form action={reserve} className="panel">
      <h2>Pilih tiket</h2>
      {classes.length === 0 ? (
        <p>Penjualan belum dibuka.</p>
      ) : (
        classes.map((item) => (
          <label key={item.id}>
            {item.mode === "VENUE" ? "Hadir langsung" : "Livestream"} ·{" "}
            {item.name} · Rp{item.price.toLocaleString("id-ID")}
            <input
              type="number"
              min="0"
              max={Math.min(10, item.available)}
              value={quantities[item.id] ?? 0}
              onChange={(event) =>
                setQuantities((current) => ({
                  ...current,
                  [item.id]: Number(event.target.value),
                }))
              }
            />
          </label>
        ))
      )}
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <p>Total Rp{total.toLocaleString("id-ID")}</p>
      <button disabled={items.length === 0} type="submit">
        Buat reservasi
      </button>
    </form>
  );
}
