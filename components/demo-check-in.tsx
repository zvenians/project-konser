"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ScanLine } from "lucide-react";
import type { Locale } from "@/lib/i18n";

type Detector = {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
};

export function DemoCheckIn({ locale }: { locale: Locale }) {
  const en = locale === "en";
  const [barcode, setBarcode] = useState("");
  const [message, setMessage] = useState("");
  const [camera, setCamera] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  async function validate(value = barcode) {
    setMessage(en ? "Validating…" : "Memvalidasi…");
    const response = await fetch("/api/demo/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode: value }),
    });
    const result = await response.json();
    setMessage(result.message);
  }

  async function startCamera() {
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
      setMessage(en ? "Camera scanning is not supported in this browser. Use manual entry." : "Pemindaian kamera tidak didukung browser ini. Gunakan input manual.");
      return;
    }
    stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    setCamera(true);
  }

  useEffect(() => {
    if (!camera || !video.current || !stream.current) return;
    video.current.srcObject = stream.current;
    const DetectorClass = (window as unknown as { BarcodeDetector: new (options: { formats: string[] }) => Detector }).BarcodeDetector;
    const detector = new DetectorClass({ formats: ["qr_code"] });
    const timer = window.setInterval(async () => {
      if (!video.current) return;
      const [found] = await detector.detect(video.current).catch(() => []);
      if (found?.rawValue) {
        setBarcode(found.rawValue);
        window.clearInterval(timer);
        stream.current?.getTracks().forEach((track) => track.stop());
        setCamera(false);
        await validate(found.rawValue);
      }
    }, 600);
    return () => window.clearInterval(timer);
  }, [camera]);

  useEffect(() => () => stream.current?.getTracks().forEach((track) => track.stop()), []);

  return (
    <div className="panel admin-form demo-checkin" data-demo-checkin>
      <label>
        {en ? "Demo QR code or ticket code" : "Kode QR atau kode tiket demo"}
        <input name="barcode" value={barcode} onChange={(event) => setBarcode(event.target.value)} required minLength={3} />
      </label>
      <div className="demo-payment-actions">
        <button type="button" onClick={() => validate()} disabled={barcode.length < 3}>
          <ScanLine size={17} /> {en ? "Validate check-in" : "Validasi check-in"}
        </button>
        <button type="button" className="secondary-button" onClick={startCamera}>
          <Camera size={17} /> {en ? "Scan with camera" : "Pindai dengan kamera"}
        </button>
      </div>
      {camera && <video ref={video} autoPlay muted playsInline className="checkin-camera" />}
      {message && <p role="status" className="demo-checkin-result">{message}</p>}
    </div>
  );
}
