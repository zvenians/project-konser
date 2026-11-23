"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type TicketClass = { id: string; name: string };
export function BatchImport({ classes }: { classes: TicketClass[] }) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const xhr = new XMLHttpRequest();
    setBusy(true);
    setProgress(0);
    setMessage("");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => {
      setMessage(
        "Koneksi terputus. Periksa kembali antrean impor sebelum mencoba lagi.",
      );
      setBusy(false);
    };
    xhr.onload = () => {
      let result: { error?: string; imported?: number } = {};
      try {
        result = JSON.parse(xhr.responseText);
      } catch {}
      setMessage(
        xhr.status === 201
          ? `${result.imported} PDF masuk antrean review.`
          : (result.error ?? "Impor gagal."),
      );
      setBusy(false);
      setProgress(null);
      if (xhr.status === 201) {
        form.reset();
        router.refresh();
      }
    };
    xhr.open("POST", "/api/admin/tickets/batch");
    xhr.send(new FormData(form));
  }
  return (
    <form className="panel admin-form" onSubmit={submit}>
      <h3>Impor PDF dalam batch</h3>
      <p>
        Manifest CSV wajib berisi kolom <code>filename,barcode,sha256</code>.
        Hash PDF harus cocok persis dengan manifest resmi penerbit. Maksimal 20
        PDF dan total 3,5 MB per unggahan.
      </p>
      <label>
        Kelas venue
        <select name="classId" required>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Manifest CSV
        <input type="file" name="manifest" accept=".csv,text/csv" required />
      </label>
      <label>
        PDF asli
        <input
          type="file"
          name="files"
          accept="application/pdf"
          multiple
          required
        />
      </label>
      <button type="submit" disabled={busy}>
        {busy ? `Mengunggah ${progress ?? 0}%` : "Impor batch"}
      </button>
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
    </form>
  );
}
