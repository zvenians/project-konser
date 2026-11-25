"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { CheckCircle2, Download, Radio, X } from "lucide-react";

type Ticket = { id: string; name: string; url: string };
type Delivery = { channel: string; status: string };

export function PaymentSuccess({ buyer, reference, total, tickets, deliveries, livestream }: {
  buyer: string; reference: string; total: string; tickets: Ticket[]; deliveries: Delivery[]; livestream: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => { const key=`sof_success_${reference}`; if (!sessionStorage.getItem(key)) { sessionStorage.setItem(key,"1"); setOpen(true); } }, [reference]);
  function downloadAll() {
    tickets.forEach((ticket, index) => setTimeout(() => {
      const anchor = document.createElement("a"); anchor.href = ticket.url; anchor.download = ""; anchor.click();
    }, index * 250));
  }
  return <AnimatePresence>{open && <motion.div className="success-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.section role="dialog" aria-modal="true" aria-labelledby="payment-success-title" className="success-modal" initial={{ opacity: 0, y: 24, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: .98 }} transition={{ duration: .24 }}>
      <button className="success-modal-close" onClick={() => setOpen(false)} aria-label="Tutup"><X size={18}/></button>
      <CheckCircle2 size={34}/><p className="eyebrow">PAYMENT VERIFIED</p><h2 id="payment-success-title">Pembayaran berhasil</h2>
      <p>Tiket dan akses digital sudah diterbitkan untuk <strong>{buyer}</strong>.</p>
      <dl><div><dt>Referensi</dt><dd>{reference}</dd></div><div><dt>Total</dt><dd>{total}</dd></div></dl>
      {tickets.length > 0 && <div className="success-ticket-actions"><h3>Tiket PDF</h3>{tickets.map(ticket => <a key={ticket.id} href={ticket.url}><Download size={16}/>{ticket.name}</a>)}{tickets.length > 1 && <button onClick={downloadAll}><Download size={16}/>Unduh semua</button>}</div>}
      {livestream && <a className="success-stream-link" href="/livestream"><Radio size={16}/>Buka livestream</a>}
      <div className="delivery-state"><h3>Status pengiriman</h3>{deliveries.length ? deliveries.map(item => <p key={`${item.channel}-${item.status}`}><span>{item.channel}</span><strong>{item.status}</strong></p>) : <p>Pengiriman belum diantrikan.</p>}</div>
      <button onClick={() => setOpen(false)}>Lihat detail pesanan</button>
    </motion.section>
  </motion.div>}</AnimatePresence>;
}
