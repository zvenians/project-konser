import { redirect } from "next/navigation";
import { logout } from "@/app/actions";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BookingForm } from "@/components/booking-form";

export default async function AccountPage() {
  const user=await currentUser();
  if(!user) redirect("/login");
  const [orders,classes,tickets]=await Promise.all([db()`SELECT id,status,total,created_at FROM orders WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 50`,db()`SELECT c.id,c.name,c.mode,c.price,CASE WHEN c.mode='VENUE' THEN count(t.id) FILTER(WHERE t.status='AVAILABLE') ELSE 10 END::integer AS available FROM ticket_classes c JOIN events e ON e.id=c.event_id LEFT JOIN ticket_inventory t ON t.class_id=c.id WHERE c.sale_enabled AND (c.mode='VENUE' OR e.streaming_ready) GROUP BY c.id ORDER BY c.price DESC`,db()`SELECT t.id,c.name FROM ticket_inventory t JOIN ticket_allocations a ON a.ticket_id=t.id JOIN order_items i ON i.id=a.item_id JOIN orders o ON o.id=i.order_id JOIN ticket_classes c ON c.id=i.class_id WHERE o.user_id=${user.id} AND o.status='CONFIRMED' AND t.status='SOLD'`]);
  return <main className="wrap section"><h1>Halo, {user.name}</h1><form action={logout}><button type="submit">Keluar</button></form><BookingForm classes={classes.filter(row=>Number(row.available)>0).map(row=>({id:String(row.id),name:String(row.name),mode:String(row.mode),price:Number(row.price),available:Number(row.available)}))}/><h2>Pesanan saya</h2>{orders.length===0?<p>Belum ada pesanan.</p>:<ul>{orders.map(order=><li key={order.id}>{order.id} · {order.status} · Rp{Number(order.total).toLocaleString("id-ID")}</li>)}</ul>}<h2>Tiket saya</h2>{tickets.length===0?<p>Belum ada PDF tiket yang tersedia.</p>:<ul>{tickets.map(ticket=><li key={ticket.id}>{ticket.name} <a href={`/api/tickets/${ticket.id}`}>Unduh PDF asli</a></li>)}</ul>}</main>;
}
