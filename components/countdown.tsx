"use client";

import { useEffect, useState } from "react";
import { countdown } from "@/lib/event";

export function Countdown() {
  const [time, setTime] = useState<ReturnType<typeof countdown> | null>(null);
  useEffect(() => {
    const update = () => setTime(countdown(Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (time?.phase === "live") return <p>Konser sedang berlangsung.</p>;
  if (time?.phase === "ended") return <p>Terima kasih sudah jadi bagian dari Symphony of Faith.</p>;
  return <div aria-label="Hitung mundur menuju Symphony of Faith" style={{ minHeight: 84, display: "flex", gap: "1rem", marginTop: "2rem" }}>
    {["Hari", "Jam", "Menit", "Detik"].map((label, i) => <div key={label}>
      <span style={{ fontVariantNumeric: "tabular-nums", fontSize: "1.75rem", display: "block" }}>{time ? String(time.values[i]).padStart(2, "0") : "--"}</span>
      <small>{label}</small>
    </div>)}
  </div>;
}
