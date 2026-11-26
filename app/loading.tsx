import { getLocale } from "@/lib/i18n";
import { secondaryMessages } from "@/lib/secondary-messages";

export default async function Loading() {
  const t = secondaryMessages(await getLocale()).loading;
  return (
    <main className="loading-stage" role="status" aria-live="polite">
      <div className="loading-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
        <i />
      </div>
      <div className="loading-copy">
        <p className="eyebrow">SYMPHONY OF FAITH</p>
        <h1>{t.loading}</h1>
        <div className="loading-progress" aria-hidden="true"><span /></div>
      </div>
    </main>
  );
}
