"use client";
import { Share2 } from "lucide-react";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

export function ShareButton({ locale }: { locale: Locale }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="share-button"
      onClick={async () => {
        const data = {
          title: "Symphony of Faith",
          url: window.location.origin,
        };
        if (navigator.share) {
          try {
            await navigator.share(data);
          } catch {}
        } else {
          await navigator.clipboard.writeText(data.url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }}
    >
      <Share2 size={17} />
      {copied
        ? locale === "id"
          ? "Tautan disalin"
          : "Link copied"
        : locale === "id"
          ? "Bagikan"
          : "Share"}
    </button>
  );
}
