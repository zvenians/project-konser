import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { secondaryMessages } from "@/lib/secondary-messages";

export default async function DonationReceived() {
  const t = secondaryMessages(await getLocale()).donationReceived;
  return (
    <main className="wrap section">
      <h1>{t.donationSubmitted}</h1>
      <p>{t.yourDonationWillBeCountedAfter}</p>
      <Link href="/">{t.backToHome}</Link>
    </main>
  );
}
