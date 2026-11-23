"use server";

import { compare, hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, endSession, requireAdmin, requireUser } from "@/lib/auth";

const credentials = z.object({email:z.email().max(254),password:z.string().min(12).max(128)});

export async function register(form: FormData) {
  const values = credentials.extend({name:z.string().trim().min(2).max(100)}).parse(Object.fromEntries(form));
  const [user] = await db()`INSERT INTO users(email,name,password_hash) VALUES (${values.email.toLowerCase()},${values.name},${await hash(values.password,12)}) RETURNING id`;
  await createSession(user.id);
  redirect("/account");
}

export async function login(form: FormData) {
  const values = credentials.parse(Object.fromEntries(form));
  const [user] = await db()`SELECT id,password_hash FROM users WHERE email=${values.email.toLowerCase()}`;
  if (!user || !(await compare(values.password,user.password_hash))) throw new Error("Email atau kata sandi salah.");
  await createSession(user.id);
  redirect("/account");
}

export async function logout() { await endSession(); redirect("/"); }

export async function reserve(form: FormData) {
  const user = await requireUser();
  const items = z.array(z.object({classId:z.uuid(),quantity:z.number().int().min(1).max(10)})).min(1).max(10).parse(JSON.parse(String(form.get("items") ?? "[]")));
  if (new Set(items.map(x=>x.classId)).size !== items.length) throw new Error("Kelas tiket duplikat.");
  const key = z.uuid().parse(form.get("idempotencyKey"));
  const sql = db();
  await sql.begin(async tx => {
    const [previous] = await tx`SELECT id FROM orders WHERE idempotency_key=${key}`;
    if (previous) return;
    const allocations: {itemId:string;ticketId:string}[] = [];
    const prepared: {classId:string;quantity:number;price:number;ticketIds:string[];eventId:string;mode:string}[] = [];
    for (const item of [...items].sort((a,b)=>a.classId.localeCompare(b.classId))) {
      const [ticketClass] = await tx`SELECT c.*, e.streaming_ready FROM ticket_classes c JOIN events e ON e.id=c.event_id WHERE c.id=${item.classId} FOR UPDATE OF c`;
      if (!ticketClass?.sale_enabled || item.quantity>ticketClass.max_per_order) throw new Error("Kelas tiket belum tersedia.");
      if (ticketClass.mode==="LIVESTREAM" && !ticketClass.streaming_ready) throw new Error("Akses livestream belum tersedia.");
      let ticketIds:string[]=[];
      if (ticketClass.mode==="VENUE") {
        const rows = await tx`SELECT id FROM ticket_inventory WHERE class_id=${item.classId} AND status='AVAILABLE' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT ${item.quantity}`;
        ticketIds=rows.map(row=>row.id);
        if (ticketIds.length!==item.quantity) throw new Error("Stok tiket terverifikasi tidak mencukupi.");
      }
      prepared.push({classId:item.classId,quantity:item.quantity,price:Number(ticketClass.price),ticketIds,eventId:ticketClass.event_id,mode:ticketClass.mode});
    }
    const total=prepared.reduce((sum,item)=>sum+item.price*item.quantity,0);
    const [order]=await tx`INSERT INTO orders(user_id,idempotency_key,total,expires_at) VALUES (${user.id},${key},${total},now()+interval '15 minutes') RETURNING id`;
    for (const item of prepared) {
      const [orderItem]=await tx`INSERT INTO order_items(order_id,class_id,quantity,unit_price) VALUES (${order.id},${item.classId},${item.quantity},${item.price}) RETURNING id`;
      for (const ticketId of item.ticketIds) allocations.push({itemId:orderItem.id,ticketId});
      if(item.mode==="LIVESTREAM") await tx`INSERT INTO stream_entitlements(user_id,event_id,order_id) VALUES (${user.id},${item.eventId},${order.id}) ON CONFLICT DO NOTHING`;
    }
    for (const allocation of allocations) {
      await tx`UPDATE ticket_inventory SET status='RESERVED' WHERE id=${allocation.ticketId}`;
      await tx`INSERT INTO ticket_allocations(ticket_id,item_id) VALUES (${allocation.ticketId},${allocation.itemId})`;
    }
  });
  redirect("/account");
}

export async function releaseExpired() {
  await requireAdmin();
  await db().begin(async tx => {
    const expired=await tx`UPDATE orders SET status='EXPIRED' WHERE status='PENDING' AND expires_at<now() RETURNING id`;
    for(const order of expired) {
      await tx`UPDATE ticket_inventory SET status='AVAILABLE' WHERE id IN (SELECT a.ticket_id FROM ticket_allocations a JOIN order_items i ON i.id=a.item_id WHERE i.order_id=${order.id})`;
      await tx`DELETE FROM ticket_allocations WHERE item_id IN (SELECT id FROM order_items WHERE order_id=${order.id})`;
    }
  });
}

export async function confirmOrder(form:FormData) {
  const admin=await requireAdmin();
  const id=z.uuid().parse(form.get("orderId"));
  await db().begin(async tx=>{
    const [order]=await tx`SELECT id,user_id,status,expires_at FROM orders WHERE id=${id} FOR UPDATE`;
    if(!order || order.status!=="PENDING" || new Date(order.expires_at).getTime()<Date.now()) throw new Error("Pesanan tidak dapat dikonfirmasi.");
    await tx`UPDATE orders SET status='CONFIRMED' WHERE id=${id}`;
    await tx`UPDATE ticket_inventory SET status='SOLD' WHERE id IN (SELECT a.ticket_id FROM ticket_allocations a JOIN order_items i ON i.id=a.item_id WHERE i.order_id=${id})`;
    await tx`UPDATE stream_entitlements SET active=true WHERE order_id=${id}`;
    await tx`INSERT INTO audit_logs(actor_id,action,resource_id) VALUES (${admin.id},'CONFIRM_ORDER',${id})`;
  });
  redirect("/admin");
}

export async function submitDonation(form:FormData) {
  const amount=z.coerce.number().int().min(10000).max(100000000).parse(form.get("amount"));
  const name=z.string().trim().min(2).max(100).parse(form.get("name"));
  const [campaign]=await db()`SELECT id FROM donation_campaigns ORDER BY id LIMIT 1`;
  if(!campaign) throw new Error("Program donasi belum dibuka.");
  await db()`INSERT INTO donations(campaign_id,donor_name,amount) VALUES (${campaign.id},${name},${amount})`;
  redirect("/donation-received");
}

export async function verifyTicket(form:FormData) {
  const admin=await requireAdmin();
  const id=z.uuid().parse(form.get("ticketId"));
  await db().begin(async tx=>{
    const [ticket]=await tx`SELECT t.id,t.class_id,t.status,c.capacity FROM ticket_inventory t JOIN ticket_classes c ON c.id=t.class_id WHERE t.id=${id} FOR UPDATE OF t,c`;
    if(!ticket || ticket.status!=="NEEDS_REVIEW") throw new Error("Tiket tidak dapat diverifikasi.");
    const [counts]=await tx`SELECT count(*)::integer AS total FROM ticket_inventory WHERE class_id=${ticket.class_id} AND status IN ('AVAILABLE','RESERVED','SOLD')`;
    if(counts.total>=ticket.capacity) throw new Error("Kapasitas resmi sudah penuh.");
    await tx`UPDATE ticket_inventory SET status='AVAILABLE',verified_at=now() WHERE id=${id}`;
    await tx`INSERT INTO ticket_status_history(ticket_id,actor_id,from_status,to_status) VALUES (${id},${admin.id},'NEEDS_REVIEW','AVAILABLE')`;
  });
  redirect("/admin");
}

export async function verifyDonation(form:FormData) {
  const admin=await requireAdmin();
  const id=z.uuid().parse(form.get("donationId"));
  await db().begin(async tx=>{
    const [donation]=await tx`UPDATE donations SET status='VERIFIED' WHERE id=${id} AND status='PENDING' RETURNING id`;
    if(!donation) throw new Error("Donasi sudah diproses.");
    await tx`INSERT INTO audit_logs(actor_id,action,resource_id) VALUES (${admin.id},'VERIFY_DONATION',${id})`;
  });
  redirect("/admin");
}
