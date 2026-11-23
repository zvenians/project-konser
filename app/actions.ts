"use server";

import { compare, hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { expireReservations } from "@/lib/orders";
import { settingValue } from "@/lib/settings";
import {
  createSession,
  endSession,
  requireAdmin,
  requireFinance,
  requireUser,
} from "@/lib/auth";
import { demoModeEnabled, requireDemoMode } from "@/lib/demo-config";
import { DEMO_ACCOUNTS, ensureDemoData } from "@/lib/demo-data";

const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
});

export async function register(form: FormData) {
  const demo = demoModeEnabled();
  const values = credentials
    .extend({
      name: z.string().trim().min(2).max(100),
      phone: z.preprocess(
        (value) => (value === "" ? undefined : value),
        z
          .string()
          .regex(/^\+[1-9][0-9]{7,14}$/)
          .optional(),
      ),
    })
    .parse(Object.fromEntries(form));
  const consent = form.get("whatsappConsent") === "on";
  const [user] =
    await db()`INSERT INTO users(email,name,password_hash,phone,whatsapp_consent_at,is_demo) VALUES (${values.email.toLowerCase()},${values.name},${await hash(values.password, 12)},${values.phone ?? null},${consent ? new Date() : null},${demo}) RETURNING id`;
  await createSession(user.id);
  redirect(form.get("next") === "/checkout" ? "/checkout" : "/account");
}

export async function login(form: FormData) {
  const values = credentials.parse(Object.fromEntries(form));
  const email = values.email.toLowerCase();
  const demo = demoModeEnabled();
  const [attempt] =
    await db()`SELECT locked_until FROM login_attempts WHERE email=${email}`;
  if (
    attempt?.locked_until &&
    new Date(attempt.locked_until).getTime() > Date.now()
  )
    throw new Error("Terlalu banyak percobaan. Coba lagi dalam 15 menit.");
  const [user] =
    await db()`SELECT id,password_hash FROM users WHERE email=${email} AND is_demo=${demo}`;
  if (!user || !(await compare(values.password, user.password_hash))) {
    await db()`INSERT INTO login_attempts(email,attempts,window_started_at) VALUES (${email},1,now()) ON CONFLICT(email) DO UPDATE SET attempts=CASE WHEN login_attempts.window_started_at<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,window_started_at=CASE WHEN login_attempts.window_started_at<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_started_at END,locked_until=CASE WHEN login_attempts.attempts>=9 AND login_attempts.window_started_at>=now()-interval '15 minutes' THEN now()+interval '15 minutes' ELSE NULL END`;
    throw new Error("Email atau kata sandi salah.");
  }
  await db()`DELETE FROM login_attempts WHERE email=${email}`;
  await createSession(user.id);
  redirect(form.get("next") === "/checkout" ? "/checkout" : "/account");
}

export async function demoLogin(form: FormData) {
  requireDemoMode();
  await ensureDemoData();
  const role = z.enum(["customer", "admin", "finance"]).parse(form.get("role"));
  const [user] = await db()`SELECT id FROM users WHERE email=${DEMO_ACCOUNTS[role]} AND is_demo=true`;
  if (!user) throw new Error("Akun demo tidak tersedia.");
  await createSession(user.id);
  const next = form.get("next");
  redirect(role === "customer" && next === "/checkout" ? "/checkout" : role === "customer" ? "/account" : "/admin");
}

export async function logout() {
  await endSession();
  redirect("/");
}

export async function reserve(form: FormData) {
  const user = await requireUser();
  await expireReservations();
  const [instructions] =
    await db()`SELECT value FROM site_settings WHERE key='payment_instructions'`;
  const payment = settingValue<{
    bank: string;
    account: string;
    holder: string;
  }>(instructions?.value);
  if (!payment?.bank || !payment.account || !payment.holder)
    throw new Error("Pembayaran belum dibuka oleh penyelenggara.");
  const items = z
    .array(
      z.object({
        classId: z.uuid(),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .min(1)
    .max(10)
    .parse(JSON.parse(String(form.get("items") ?? "[]")));
  if (new Set(items.map((x) => x.classId)).size !== items.length)
    throw new Error("Kelas tiket duplikat.");
  const key = z.uuid().parse(form.get("idempotencyKey"));
  const sql = db();
  await sql.begin(async (tx) => {
    const [previous] =
      await tx`SELECT id,user_id FROM orders WHERE idempotency_key=${key}`;
    if (previous) {
      if (previous.user_id !== user.id)
        throw new Error("Permintaan sudah dipakai.");
      return;
    }
    const allocations: { itemId: string; ticketId: string }[] = [];
    const prepared: {
      classId: string;
      quantity: number;
      price: number;
      ticketIds: string[];
      eventId: string;
      mode: string;
    }[] = [];
    for (const item of [...items].sort((a, b) =>
      a.classId.localeCompare(b.classId),
    )) {
      const [ticketClass] =
        await tx`SELECT c.*, e.streaming_ready FROM ticket_classes c JOIN events e ON e.id=c.event_id WHERE c.id=${item.classId} FOR UPDATE OF c`;
      if (
        !ticketClass?.sale_enabled ||
        item.quantity > ticketClass.max_per_order
      )
        throw new Error("Kelas tiket belum tersedia.");
      if (ticketClass.mode === "LIVESTREAM" && !ticketClass.streaming_ready)
        throw new Error("Akses livestream belum tersedia.");
      let ticketIds: string[] = [];
      if (ticketClass.mode === "VENUE") {
        const rows =
          await tx`SELECT id FROM ticket_inventory WHERE class_id=${item.classId} AND status='AVAILABLE' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT ${item.quantity}`;
        ticketIds = rows.map((row) => row.id);
        if (ticketIds.length !== item.quantity)
          throw new Error("Stok tiket terverifikasi tidak mencukupi.");
      }
      prepared.push({
        classId: item.classId,
        quantity: item.quantity,
        price: Number(ticketClass.price),
        ticketIds,
        eventId: ticketClass.event_id,
        mode: ticketClass.mode,
      });
    }
    const total = prepared.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const [order] =
      await tx`INSERT INTO orders(user_id,idempotency_key,total,expires_at) VALUES (${user.id},${key},${total},now()+interval '24 hours') RETURNING id`;
    for (const item of prepared) {
      const [orderItem] =
        await tx`INSERT INTO order_items(order_id,class_id,quantity,unit_price) VALUES (${order.id},${item.classId},${item.quantity},${item.price}) RETURNING id`;
      for (const ticketId of item.ticketIds)
        allocations.push({ itemId: orderItem.id, ticketId });
      if (item.mode === "LIVESTREAM")
        await tx`INSERT INTO stream_entitlements(user_id,event_id,order_id) VALUES (${user.id},${item.eventId},${order.id}) ON CONFLICT DO NOTHING`;
    }
    for (const allocation of allocations) {
      await tx`UPDATE ticket_inventory SET status='RESERVED' WHERE id=${allocation.ticketId}`;
      await tx`INSERT INTO ticket_allocations(ticket_id,item_id) VALUES (${allocation.ticketId},${allocation.itemId})`;
    }
  });
  redirect("/account?reserved=1");
}

export async function releaseExpired() {
  await requireAdmin();
  await expireReservations();
}

export async function submitPayment(form: FormData) {
  const user = await requireUser();
  const id = z.uuid().parse(form.get("orderId"));
  const reference = z
    .string()
    .trim()
    .min(4)
    .max(100)
    .parse(form.get("reference"));
  await db().begin(async (tx) => {
    const [order] =
      await tx`SELECT id,status,expires_at FROM orders WHERE id=${id} AND user_id=${user.id} FOR UPDATE`;
    if (
      !order ||
      order.status !== "PENDING" ||
      new Date(order.expires_at).getTime() <= Date.now()
    )
      throw new Error("Reservasi sudah tidak berlaku.");
    await tx`INSERT INTO payment_claims(order_id,submitted_by,transfer_reference) VALUES (${id},${user.id},${reference})`;
    await tx`UPDATE orders SET status='PAYMENT_REVIEW' WHERE id=${id}`;
    await tx`INSERT INTO order_status_history(order_id,actor_id,from_status,to_status) VALUES (${id},${user.id},'PENDING','PAYMENT_REVIEW')`;
  });
  redirect("/account");
}

export async function cancelOrder(form: FormData) {
  const user = await requireUser();
  const id = z.uuid().parse(form.get("orderId"));
  await db().begin(async (tx) => {
    const [order] =
      await tx`UPDATE orders SET status='CANCELLED' WHERE id=${id} AND user_id=${user.id} AND status='PENDING' RETURNING id`;
    if (!order) throw new Error("Pesanan tidak dapat dibatalkan.");
    await tx`UPDATE ticket_inventory SET status='AVAILABLE' WHERE id IN (SELECT a.ticket_id FROM ticket_allocations a JOIN order_items i ON i.id=a.item_id WHERE i.order_id=${id})`;
    await tx`DELETE FROM ticket_allocations WHERE item_id IN (SELECT id FROM order_items WHERE order_id=${id})`;
    await tx`INSERT INTO order_status_history(order_id,actor_id,from_status,to_status) VALUES (${id},${user.id},'PENDING','CANCELLED')`;
  });
  redirect("/account");
}

export async function confirmOrder(form: FormData) {
  const admin = await requireFinance();
  const id = z.uuid().parse(form.get("orderId"));
  const bankReference = z
    .string()
    .trim()
    .min(4)
    .max(100)
    .parse(form.get("bankReference"));
  const receivedAmount = z.coerce
    .number()
    .int()
    .positive()
    .parse(form.get("receivedAmount"));
  if (form.get("bankConfirmed") !== "on")
    throw new Error("Periksa mutasi rekening sebelum verifikasi.");
  await db().begin(async (tx) => {
    const [order] =
      await tx`SELECT id,user_id,status,expires_at,total FROM orders WHERE id=${id} FOR UPDATE`;
    if (
      !order ||
      order.status !== "PAYMENT_REVIEW" ||
      new Date(order.expires_at).getTime() <= Date.now()
    )
      throw new Error("Pesanan tidak dapat dikonfirmasi.");
    if (Number(order.total) !== receivedAmount)
      throw new Error("Jumlah transfer tidak cocok dengan pesanan.");
    await tx`INSERT INTO bank_receipts(bank_reference,amount,source_type,source_id,recorded_by) VALUES (${bankReference},${receivedAmount},'ORDER',${id},${admin.id})`;
    const [claim] =
      await tx`UPDATE payment_claims SET status='VERIFIED',bank_reference=${bankReference},reviewed_by=${admin.id},reviewed_at=now() WHERE order_id=${id} AND status='SUBMITTED' RETURNING id`;
    if (!claim) throw new Error("Bukti pembayaran belum diajukan.");
    await tx`UPDATE orders SET status='CONFIRMED' WHERE id=${id}`;
    await tx`UPDATE ticket_inventory SET status='SOLD' WHERE id IN (SELECT a.ticket_id FROM ticket_allocations a JOIN order_items i ON i.id=a.item_id WHERE i.order_id=${id})`;
    await tx`UPDATE stream_entitlements SET active=true WHERE order_id=${id}`;
    await tx`INSERT INTO order_status_history(order_id,actor_id,from_status,to_status) VALUES (${id},${admin.id},'PAYMENT_REVIEW','CONFIRMED')`;
    await tx`INSERT INTO notification_outbox(order_id,kind,user_id) VALUES (${id},'PAYMENT_CONFIRMED',${order.user_id}) ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO audit_logs(actor_id,action,resource_id) VALUES (${admin.id},'CONFIRM_ORDER',${id})`;
  });
  redirect("/admin");
}

export async function submitDonation(form: FormData) {
  const [instructions] =
    await db()`SELECT value FROM site_settings WHERE key='payment_instructions'`;
  if (!settingValue<{ bank: string }>(instructions?.value)?.bank)
    throw new Error("Pembayaran donasi belum dibuka.");
  const amount = z.coerce
    .number()
    .int()
    .min(10000)
    .max(100000000)
    .parse(form.get("amount"));
  const name = z.string().trim().min(2).max(100).parse(form.get("name"));
  const reference = z
    .string()
    .trim()
    .min(4)
    .max(100)
    .parse(form.get("reference"));
  const [campaign] =
    await db()`SELECT id FROM donation_campaigns ORDER BY id LIMIT 1`;
  if (!campaign) throw new Error("Program donasi belum dibuka.");
  const [donation] =
    await db()`INSERT INTO donations(campaign_id,donor_name,amount,payment_reference,anonymous) VALUES (${campaign.id},${name},${amount},${reference},${form.get("anonymous") === "on"}) RETURNING id`;
  redirect(`/donations/${donation.id}`);
}

export async function verifyTicket(form: FormData) {
  const admin = await requireAdmin();
  const id = z.uuid().parse(form.get("ticketId"));
  await db().begin(async (tx) => {
    const [ticket] =
      await tx`SELECT t.id,t.class_id,t.status,c.capacity FROM ticket_inventory t JOIN ticket_classes c ON c.id=t.class_id WHERE t.id=${id} FOR UPDATE OF t,c`;
    if (!ticket || ticket.status !== "NEEDS_REVIEW")
      throw new Error("Tiket tidak dapat diverifikasi.");
    const [counts] =
      await tx`SELECT count(*)::integer AS total FROM ticket_inventory WHERE class_id=${ticket.class_id} AND status IN ('AVAILABLE','RESERVED','SOLD')`;
    if (counts.total >= ticket.capacity)
      throw new Error("Kapasitas resmi sudah penuh.");
    await tx`UPDATE ticket_inventory SET status='AVAILABLE',verified_at=now() WHERE id=${id}`;
    await tx`INSERT INTO ticket_status_history(ticket_id,actor_id,from_status,to_status) VALUES (${id},${admin.id},'NEEDS_REVIEW','AVAILABLE')`;
  });
  redirect("/admin");
}

export async function verifyDonation(form: FormData) {
  const admin = await requireFinance();
  const id = z.uuid().parse(form.get("donationId"));
  const bankReference = z
    .string()
    .trim()
    .min(4)
    .max(100)
    .parse(form.get("bankReference"));
  const receivedAmount = z.coerce
    .number()
    .int()
    .positive()
    .parse(form.get("receivedAmount"));
  if (form.get("bankConfirmed") !== "on")
    throw new Error("Periksa mutasi rekening sebelum verifikasi.");
  await db().begin(async (tx) => {
    const [pending] =
      await tx`SELECT amount FROM donations WHERE id=${id} AND status='PENDING' AND expires_at>now() AND payment_reference IS NOT NULL FOR UPDATE`;
    if (!pending || Number(pending.amount) !== receivedAmount)
      throw new Error("Jumlah transfer tidak cocok dengan donasi.");
    await tx`INSERT INTO bank_receipts(bank_reference,amount,source_type,source_id,recorded_by) VALUES (${bankReference},${receivedAmount},'DONATION',${id},${admin.id})`;
    const [donation] =
      await tx`UPDATE donations SET status='VERIFIED',bank_reference=${bankReference},verified_by=${admin.id},verified_at=now() WHERE id=${id} AND status='PENDING' RETURNING id`;
    if (!donation) throw new Error("Donasi sudah diproses.");
    await tx`INSERT INTO audit_logs(actor_id,action,resource_id) VALUES (${admin.id},'VERIFY_DONATION',${id})`;
  });
  redirect("/admin");
}

export async function configurePayment(form: FormData) {
  const admin = await requireAdmin();
  const bank = z.string().trim().min(2).max(80).parse(form.get("bank"));
  const account = z.string().trim().min(5).max(40).parse(form.get("account"));
  const holder = z.string().trim().min(2).max(100).parse(form.get("holder"));
  const value = JSON.stringify({ bank, account, holder });
  await db()`INSERT INTO site_settings(key,value) VALUES ('payment_instructions',${value}::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value`;
  await db()`INSERT INTO audit_logs(actor_id,action,resource_id) VALUES (${admin.id},'CONFIGURE_PAYMENT','payment_instructions')`;
  redirect("/admin");
}

export async function configureStream(form: FormData) {
  const admin = await requireAdmin();
  const videoId = z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{11}$/)
    .parse(form.get("videoId"));
  const state = z
    .enum(["NOT_STARTED", "LIVE", "ENDED"])
    .parse(form.get("state"));
  const value = JSON.stringify({ videoId, state });
  await db().begin(async (tx) => {
    await tx`INSERT INTO site_settings(key,value) VALUES ('stream',${value}::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value`;
    await tx`UPDATE events SET streaming_ready=true`;
    await tx`INSERT INTO audit_logs(actor_id,action,resource_id) VALUES (${admin.id},'CONFIGURE_STREAM','stream')`;
  });
  redirect("/admin");
}

export async function setTicketSale(form: FormData) {
  const admin = await requireAdmin();
  const id = z.uuid().parse(form.get("classId"));
  const enabled = form.get("enabled") === "true";
  await db().begin(async (tx) => {
    const [row] =
      await tx`SELECT c.mode,e.streaming_ready FROM ticket_classes c JOIN events e ON e.id=c.event_id WHERE c.id=${id} FOR UPDATE OF c`;
    if (!row) throw new Error("Kelas tiket tidak ditemukan.");
    if (enabled && row.mode === "VENUE") {
      const [stock] =
        await tx`SELECT count(*)::integer AS total FROM ticket_inventory WHERE class_id=${id} AND status='AVAILABLE'`;
      if (stock.total === 0) throw new Error("Belum ada PDF terverifikasi.");
    }
    if (enabled && row.mode === "LIVESTREAM" && !row.streaming_ready)
      throw new Error("Siaran belum dikonfigurasi.");
    await tx`UPDATE ticket_classes SET sale_enabled=${enabled} WHERE id=${id}`;
    await tx`INSERT INTO audit_logs(actor_id,action,resource_id) VALUES (${admin.id},${enabled ? "OPEN_SALE" : "CLOSE_SALE"},${id})`;
  });
  redirect("/admin#inventory");
}

export async function checkInTicket(form: FormData) {
  const admin = await requireAdmin();
  const barcode = z.string().trim().min(3).max(512).parse(form.get("barcode"));
  await db().begin(async (tx) => {
    const [ticket] =
      await tx`SELECT t.id,t.status,o.status AS order_status FROM ticket_inventory t JOIN ticket_allocations a ON a.ticket_id=t.id JOIN order_items i ON i.id=a.item_id JOIN orders o ON o.id=i.order_id WHERE t.barcode=${barcode} FOR UPDATE OF t`;
    if (
      !ticket ||
      ticket.status !== "SOLD" ||
      ticket.order_status !== "CONFIRMED"
    )
      throw new Error("Kode tiket tidak valid untuk masuk.");
    const [existing] =
      await tx`SELECT 1 FROM ticket_checkins WHERE ticket_id=${ticket.id}`;
    if (existing) throw new Error("Tiket sudah digunakan untuk masuk.");
    await tx`INSERT INTO ticket_checkins(ticket_id,checked_in_by) VALUES (${ticket.id},${admin.id})`;
    await tx`INSERT INTO audit_logs(actor_id,action,resource_id) VALUES (${admin.id},'CHECK_IN_TICKET',${ticket.id})`;
  });
  redirect("/admin#checkin");
}

export async function setUserRole(form: FormData) {
  const admin = await requireAdmin();
  const userId = z.uuid().parse(form.get("userId"));
  const role = z.enum(["CUSTOMER", "FINANCE", "ADMIN"]).parse(form.get("role"));
  if (userId === admin.id && role !== "ADMIN")
    throw new Error("Anda tidak dapat menurunkan peran akun sendiri.");
  await db().begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(427312)`;
    const [target] =
      await tx`SELECT role FROM users WHERE id=${userId} FOR UPDATE`;
    if (!target) throw new Error("Pengguna tidak ditemukan.");
    if (target.role === "ADMIN" && role !== "ADMIN") {
      const [count] =
        await tx`SELECT count(*)::integer AS total FROM users WHERE role='ADMIN'`;
      if (count.total <= 1)
        throw new Error("Admin terakhir tidak dapat diturunkan.");
    }
    await tx`UPDATE users SET role=${role} WHERE id=${userId}`;
    await tx`INSERT INTO audit_logs(actor_id,action,resource_id,details) VALUES (${admin.id},'SET_USER_ROLE',${userId},${JSON.stringify({ from: target.role, to: role })}::jsonb)`;
  });
  redirect("/admin#users");
}
