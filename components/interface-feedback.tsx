"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, X } from "lucide-react";
import type { Locale } from "@/lib/locale-format";

export function InterfaceFeedback({ locale }: { locale: Locale }) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invalidLock = useRef(0);

  useEffect(() => {
    const dismissLater = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(""), 4200);
    };
    const onInvalid = (event: Event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
      event.preventDefault();
      field.classList.remove("field-invalid-pop");
      requestAnimationFrame(() => field.classList.add("field-invalid-pop"));
      const now = Date.now();
      if (now - invalidLock.current < 120) return;
      invalidLock.current = now;
      setMessage(field.validationMessage || (locale === "id" ? "Cek lagi bagian yang ditandai." : "Please check the highlighted field."));
      field.focus({ preventScroll: true });
      field.scrollIntoView({ behavior: "smooth", block: "center" });
      dismissLater();
    };
    const onInput = (event: Event) => {
      if (event.target instanceof HTMLElement) event.target.classList.remove("field-invalid-pop");
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      form.dataset.submitting = "true";
      window.setTimeout(() => delete form.dataset.submitting, 9000);
    };
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [locale]);

  return (
    <AnimatePresence>
      {message && (
        <motion.aside
          className="interface-notice interface-notice-error"
          role="alert"
          aria-live="assertive"
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: 0.24, ease: [0.22, 0.8, 0.22, 1] }}
        >
          <AlertCircle aria-hidden="true" size={20} />
          <div>
            <strong>{locale === "id" ? "Ada yang perlu dicek" : "Something needs attention"}</strong>
            <p>{message}</p>
          </div>
          <button type="button" onClick={() => setMessage("")} aria-label={locale === "id" ? "Tutup notifikasi" : "Close notification"}>
            <X aria-hidden="true" size={17} />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
