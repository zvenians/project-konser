import type { ReactNode } from "react";
import "./globals.css";
import "./concert.css";
import { ThemePreference } from "@/components/theme-preference";

export const metadata = {
  metadataBase: new URL("https://symphonyoffaith.vercel.app"),
  title: "Symphony of Faith — Charity Concert Medan 2027",
  description:
    "Konser amal Symphony of Faith, Minggu 7 Februari 2027 di Tiara Convention Hall, Medan. Informasi tiket venue dan livestream resmi.",
  openGraph: {
    title: "Symphony of Faith — Charity Concert Medan 2027",
    description: "Satu malam musik, iman, dan kepedulian di Medan.",
    type: "website" as const,
    images: ["/brand/sof-gold-logo.png"],
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <ThemePreference />
        {children}
      </body>
    </html>
  );
}
