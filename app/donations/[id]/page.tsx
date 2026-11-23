import { notFound } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { secondaryMessages, secondaryStatus } from "@/lib/secondary-messages";

export const dynamic = "force-dynamic";
export default async function DonationStatus({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [donation] =
    await db()`SELECT id,amount,status,created_at FROM donations WHERE id=${id.data}`;
  if (!donation) notFound();
  const locale = await getLocale();
  const t = secondaryMessages(locale).donationStatus;
  return (
    <main className="wrap section">
      <p className="eyebrow">SYMPHONY OF FAITH / {t.donationsLabel}</p>
      <h1>{t.yourDonationStatus}</h1>
      <div className="panel" style={{ maxWidth: 640 }}>
        <p>
          {t.reference}: {donation.id}
        </p>
        <h2>Rp{Number(donation.amount).toLocaleString("id-ID")}</h2>
        <p>
          Status:{" "}
          <strong>{secondaryStatus(locale, String(donation.status))}</strong>
        </p>
        <p>
          {donation.status === "VERIFIED"
            ? t.verifiedDescription
            : donation.status === "PENDING"
              ? t.pendingDescription
              : t.unverifiedDescription}
        </p>
      </div>
      <p>{t.saveThisPageAddressToCheck}</p>
      <Link href="/">{t.backToHome} ↗</Link>
    </main>
  );
}
