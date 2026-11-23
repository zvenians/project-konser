import { redirect } from "next/navigation";
import { confirmOrder, releaseExpired, verifyDonation, verifyTicket } from "@/app/actions";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AdminPage() {
  const user=await currentUser();
  if(!user || !["ADMIN","FINANCE"].includes(user.role)) redirect("/login");
  const [stock,orders,donations,review,donationQueue]=await Promise.all([
    db()`SELECT c.name,c.capacity,count(t.id) FILTER(WHERE t.status='AVAILABLE') AS available,count(t.id) FILTER(WHERE t.status='SOLD') AS sold FROM ticket_classes c LEFT JOIN ticket_inventory t ON t.class_id=c.id WHERE c.mode='VENUE' GROUP BY c.id ORDER BY c.price DESC`,
    db()`SELECT id,status,total,created_at FROM orders ORDER BY created_at DESC LIMIT 50`,
    db()`SELECT status,count(*) AS count,coalesce(sum(amount),0) AS total FROM donations GROUP BY status`,
    db()`SELECT t.id,c.name,t.barcode,t.original_name FROM ticket_inventory t JOIN ticket_classes c ON c.id=t.class_id WHERE t.status='NEEDS_REVIEW' ORDER BY t.id LIMIT 50`,
    db()`SELECT id,donor_name,amount FROM donations WHERE status='PENDING' ORDER BY created_at LIMIT 50`,
  ]);
  return <main className="wrap section"><h1>Pengelolaan konser</h1><h2>Inventaris venue</h2><ul>{stock.map(row=><li key={row.name}>{row.name} · Kapasitas {row.capacity} · Tersedia {row.available} · Terjual {row.sold}</li>)}</ul><h2>Review PDF</h2><ul>{review.map(row=><li key={row.id}>{row.name} · {row.original_name} · {row.barcode}<form action={verifyTicket}><input type="hidden" name="ticketId" value={row.id}/><button type="submit">Verifikasi kode dengan manifest penerbit</button></form></li>)}</ul><h2>Donasi</h2><ul>{donations.map(row=><li key={row.status}>{row.status} · {row.count} · Rp{Number(row.total).toLocaleString("id-ID")}</li>)}</ul><ul>{donationQueue.map(row=><li key={row.id}>{row.donor_name} · Rp{Number(row.amount).toLocaleString("id-ID")}<form action={verifyDonation}><input type="hidden" name="donationId" value={row.id}/><button type="submit">Verifikasi penerimaan</button></form></li>)}</ul><h2>Pesanan terbaru</h2><form action={releaseExpired}><button type="submit">Lepaskan reservasi kedaluwarsa</button></form>{orders.length===0?<p>Belum ada pesanan.</p>:<ul>{orders.map(order=><li key={order.id}>{order.id} · {order.status} · Rp{Number(order.total).toLocaleString("id-ID")}{order.status==="PENDING"&&<form action={confirmOrder}><input type="hidden" name="orderId" value={order.id}/><button type="submit">Konfirmasi manual</button></form>}</li>)}</ul>}</main>;
}
