import { randomUUID } from "node:crypto";
import { submitDemoDonation, submitDonation } from "@/app/actions";
import Link from "next/link";
import { db } from "@/lib/db";
import { settingValue } from "@/lib/settings";
import { getLocale } from "@/lib/i18n";
import { secondaryMessages } from "@/lib/secondary-messages";
import { demoModeEnabled } from "@/lib/demo-config";
import { ensureDemoData } from "@/lib/demo-data";
import { contributionTiers } from "@/lib/event";

export const dynamic = "force-dynamic";
export default async function DonatePage({ searchParams }: { searchParams: Promise<{ tier?: string }> }) {
  const demo = demoModeEnabled();
  if (demo) await ensureDemoData();
  const locale = await getLocale();
  const t = secondaryMessages(locale).donate;
  const params = await searchParams;
  const selectedTier = contributionTiers.find((tier) => tier.name === params.tier);
  const [setting] =
    await db()`SELECT value FROM site_settings WHERE key='payment_instructions'`;
  const payment = settingValue<{
    bank: string;
    account: string;
    holder: string;
  }>(setting?.value);
  return (
    <main className="wrap section">
      <p className="eyebrow">SYMPHONY OF FAITH / {t.donationsLabel}</p>
      <h1>{t.giveWithCare}</h1>
      <p>{t.donationsAreRecordedSeparatelyFromTickets}</p>
      {demo ? (
        <div className="split demo-donation-flow">
          <div className="payment-box">
            <h2>{locale === "id" ? "Donasi simulasi" : "Simulated donation"}</h2>
            <p>{locale === "id" ? "Tidak ada transfer atau uang nyata. Hasil tersimpan sebagai data demonstrasi." : "No transfer or real money is involved. The result is stored as demonstration data."}</p>
          </div>
          <form className="panel" action={submitDemoDonation}>
            <input type="hidden" name="idempotencyKey" value={randomUUID()} />
            {selectedTier && <input type="hidden" name="tier" value={selectedTier.name} />}
            {selectedTier && <p className="selected-contribution">{selectedTier.name} · Rp{selectedTier.price.toLocaleString("id-ID")}</p>}
            <label>{t.donorName}<input name="name" minLength={2} maxLength={100} required /></label>
            <label>{t.donationAmountRp}<input name="amount" type="number" min={10000} max={100000000} step={1000} defaultValue={selectedTier?.price} required /></label>
            <label className="check"><input type="checkbox" name="anonymous" /> {t.showMeAsAnonymousIfA}</label>
            <button type="submit">{locale === "id" ? "Simulasikan donasi" : "Simulate donation"}</button>
          </form>
        </div>
      ) : payment?.bank ? (
        <div className="split">
          <div className="payment-box">
            <h2>{t.transferInstructions}</h2>
            <p>
              Bank {payment.bank}
              <br />
              {t.account} {payment.account}
              <br />
              {t.accountHolder} {payment.holder}
            </p>
            <p>{t.enterYourTransferReferenceAfterPayment}</p>
          </div>
          <form className="panel" action={submitDonation}>
            {selectedTier && <input type="hidden" name="tier" value={selectedTier.name} />}
            {selectedTier && <p className="selected-contribution">{selectedTier.name} · Rp{selectedTier.price.toLocaleString("id-ID")}</p>}
            <label>
              {t.donorName}
              <input name="name" minLength={2} maxLength={100} required />
            </label>
            <label>
              {t.donationAmountRp}
              <input
                name="amount"
                type="number"
                min={10000}
                max={100000000}
                step={1000}
                defaultValue={selectedTier?.price}
                required
              />
            </label>
            <label>
              {t.transferReference}
              <input name="reference" minLength={4} maxLength={100} required />
            </label>
            <label className="check">
              <input type="checkbox" name="anonymous" />{" "}
              {t.showMeAsAnonymousIfA}
            </label>
            <button type="submit">{t.submitDonationForVerification}</button>
          </form>
        </div>
      ) : (
        <p className="empty">{t.donationsAreNotOpenYetOfficial}</p>
      )}
      <Link href="/">← {t.backToHome}</Link>
    </main>
  );
}
