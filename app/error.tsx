"use client";
import Link from "next/link";
import { secondaryMessages } from "@/lib/secondary-messages";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const englishCookie = () =>
  document.cookie.split("; ").some((cookie) => cookie === "sof_locale=en");

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useSyncExternalStore(subscribe, englishCookie, () => false)
    ? "en"
    : "id";
  const t = secondaryMessages(locale).error;
  return (
    <main className="wrap section">
      <p className="eyebrow">SYMPHONY OF FAITH</p>
      <h1>{t.somethingWentWrong}</h1>
      <p>{t.checkYourDetailsAndTryAgain}</p>
      <button type="button" onClick={reset} className="secondary-button">
        {t.tryAgain}
      </button>
      <p>
        <Link href="/">{t.backToHome} ↗</Link>
      </p>
    </main>
  );
}
