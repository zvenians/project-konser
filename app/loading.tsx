import { getLocale } from "@/lib/i18n";
import { secondaryMessages } from "@/lib/secondary-messages";

export default async function Loading() {
  const t = secondaryMessages(await getLocale()).loading;
  return (
    <main className="wrap section" role="status" aria-live="polite">
      <p className="eyebrow">SYMPHONY OF FAITH</p>
      <h1>{t.loading}</h1>
    </main>
  );
}
