import { getLocale } from "@/lib/i18n";
import { Music2 } from "lucide-react";

export default async function Loading() {
  const locale = await getLocale();
  const en = locale === "en";
  return (
    <main className="loading-stage" role="status" aria-live="polite">
      <div className="concert-loader" aria-hidden="true">
        <div className="music-staff">
          <span /><span /><span /><span /><span />
          <Music2 size={38} strokeWidth={1.5} />
        </div>
        <div className="sound-wave">
          {Array.from({ length: 13 }, (_, index) => <i key={index} />)}
        </div>
      </div>
      <div className="loading-copy">
        <p className="eyebrow">SYMPHONY OF FAITH · LIVE EXPERIENCE</p>
        <h1>{en ? "Preparing the stage…" : "Menyiapkan panggung…"}</h1>
        <p>{en ? "One moment—we are tuning your concert experience." : "Sebentar, kami sedang menyelaraskan pengalaman konsermu."}</p>
      </div>
    </main>
  );
}
