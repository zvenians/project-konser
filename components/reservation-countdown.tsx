"use client";

import { useEffect, useState } from "react";

function remaining(expiresAt: string) {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

export function ReservationCountdown({
  expiresAt,
  locale,
}: {
  expiresAt: string;
  locale: "id" | "en";
}) {
  const [milliseconds, setMilliseconds] = useState(() => remaining(expiresAt));

  useEffect(() => {
    const update = () => setMilliseconds(remaining(expiresAt));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const value = [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");

  return (
    <p className="reservation-countdown" role="timer" aria-live="polite">
      {milliseconds > 0
        ? `${locale === "id" ? "Sisa waktu reservasi" : "Reservation time left"}: ${value}`
        : locale === "id"
          ? "Reservasi kedaluwarsa. Muat ulang untuk memulihkan stok."
          : "Reservation expired. Refresh to restore stock."}
    </p>
  );
}
