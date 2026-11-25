import { requestClaim, verifyClaim } from "@/app/actions";
import { currentClaim } from "@/lib/guest";
import { db } from "@/lib/db";
import { demoModeEnabled } from "@/lib/demo-config";

export default async function ClaimTicketPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const query = await searchParams;
  const otp = query.otp === "1";
  const claim = await currentClaim("TICKET");
  const tickets = claim ? await db()`SELECT t.id,c.name,t.barcode FROM ticket_inventory t JOIN ticket_allocations a ON a.ticket_id=t.id JOIN order_items i ON i.id=a.item_id JOIN orders o ON o.id=i.order_id JOIN ticket_classes c ON c.id=i.class_id WHERE encode(digest(o.buyer_phone,'sha256'),'hex')=${claim.destination_hash} AND o.status='CONFIRMED' AND o.is_demo=${demoModeEnabled()} AND t.status='SOLD' AND t.is_demo=${demoModeEnabled()} ORDER BY c.name,t.id` : [];
  return <main className="claim-page event-container">
    <p className="eyebrow">SECURE CLAIM</p>
    <h1>Claim Ticket</h1>
    <p>Akses tiket tanpa akun. Kami tidak pernah menampilkan data pembelian sebelum nomor WhatsApp terverifikasi.</p>
    {query.sent && <p className="claim-notice">Jika email tercatat pada pesanan terkonfirmasi, tiket telah diantrikan untuk dikirim ulang.</p>}
    {query.cooldown && <p className="checkout-warning">Tunggu satu menit sebelum meminta kode baru.</p>}
    {claim ? <section className="claimed-tickets"><h2>Tiket terverifikasi</h2>{tickets.length ? tickets.map((ticket) => <a key={ticket.id} href={`/api/tickets/${ticket.id}`}>{ticket.name}<small>{ticket.barcode}</small><span>Unduh PDF</span></a>) : <p>Belum ada tiket venue terkonfirmasi untuk nomor ini.</p>}</section> : otp ? <form action={verifyClaim} className="claim-form">
      <input type="hidden" name="channel" value={query.channel}/><input type="hidden" name="scope" value={query.scope}/>
      <label>Nomor WhatsApp atau email<input name="destination" required /></label>
      <label>Kode 6 digit<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></label>
      <button>Verifikasi</button>
    </form> : <div className="claim-methods">
      <form action={requestClaim} className="claim-form"><input type="hidden" name="channel" value="WHATSAPP"/><input type="hidden" name="scope" value="TICKET"/><label>Nomor WhatsApp pembelian<input name="destination" type="tel" required /></label><button>Kirim OTP WhatsApp</button></form>
      <form action={requestClaim} className="claim-form"><input type="hidden" name="channel" value="EMAIL"/><input type="hidden" name="scope" value="TICKET"/><label>Email pembelian<input name="destination" type="email" required /></label><button>Kirim ulang ke email</button><small>Respons selalu sama untuk melindungi data pelanggan.</small></form>
    </div>}
  </main>;
}
