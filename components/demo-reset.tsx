"use client";

import { useRef } from "react";
import { resetDemoDataAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";

export function DemoReset({ locale }: { locale: Locale }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const en = locale === "en";
  return (
    <>
      <button type="button" className="danger-button" onClick={() => dialog.current?.showModal()}>
        {en ? "Reset demo data" : "Reset data demo"}
      </button>
      <dialog ref={dialog} className="demo-reset-dialog">
        <h3>{en ? "Restore the client demo?" : "Pulihkan demo klien?"}</h3>
        <p>{en ? "Presentation transactions will be removed and the official 1,685-ticket venue stock will be restored." : "Transaksi presentasi akan dihapus dan stok venue resmi 1.685 tiket akan dipulihkan."}</p>
        <div className="demo-payment-actions">
          <button type="button" className="secondary-button" onClick={() => dialog.current?.close()}>{en ? "Keep data" : "Pertahankan data"}</button>
          <form action={resetDemoDataAction}><button type="submit" className="danger-button">{en ? "Confirm reset" : "Konfirmasi reset"}</button></form>
        </div>
      </dialog>
    </>
  );
}
