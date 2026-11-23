import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import "./concert.css";
import { getLocale } from "@/lib/i18n";
import { PublicNavigation } from "@/components/public-navigation";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const title =
    locale === "id"
      ? "Symphony of Faith — Konser Amal Medan 2027"
      : "Symphony of Faith — Charity Concert Medan 2027";
  const description =
    locale === "id"
      ? "7 Februari 2027, 19:00–22:00 WIB di Tiara Convention Hall, Medan. Tiket venue dan livestream resmi."
      : "February 7, 2027, 19:00–22:00 WIB at Tiara Convention Hall, Medan. Official venue and livestream tickets.";
  return {
    metadataBase: new URL("https://symphonyoffaith.vercel.app"),
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: ["/brand/sof-gold-logo.png"],
    },
  };
}

export default async function Layout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <PublicNavigation locale={locale} />
        {children}
      </body>
    </html>
  );
}
