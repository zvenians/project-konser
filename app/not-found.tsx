import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { secondaryMessages } from "@/lib/secondary-messages";

export default async function NotFound() {
  const t = secondaryMessages(await getLocale()).notFound;
  return (
    <main className="wrap section">
      <p className="eyebrow">404 / SYMPHONY OF FAITH</p>
      <h1>{t.pageNotFound}</h1>
      <p>{t.thisLinkMayHaveChanged}</p>
      <Link href="/">{t.backToHome} ↗</Link>
    </main>
  );
}
