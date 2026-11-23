import type { ReactNode } from "react";
import "./globals.css";
import "./concert.css";

export const metadata = { title: "Symphony of Faith", description: "Demo konser amal Symphony of Faith." };

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="id" suppressHydrationWarning><body>{children}</body></html>;
}
