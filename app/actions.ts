"use server";

import { compare, hash } from "bcryptjs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { expireReservations } from "@/lib/orders";
import { settingValue } from "@/lib/settings";
import {
  createSession,
  endSession,
  requireAdmin,
  requireFinance,
  requireCheckIn,
  requireStreamOperator,
  requireUser,
  currentUser,
} from "@/lib/auth";
import { demoModeEnabled, requireDemoMode } from "@/lib/demo-config";
import { DEMO_ACCOUNTS, resetDemoData } from "@/lib/demo-data";
import { contributionTiers, livestreamPackages, venueClasses } from "@/lib/event";
import { cartTotal, reservationIsActive } from "@/lib/transactions";
import { demoCustomerEmail } from "@/lib/demo-identity";
import { broadcastStates, normalizeStreamConfig } from "@/lib/streaming";
import { guestOrderTokenHash, newGuestToken, normalizePhone, setGuestOrderToken, tokenDigest } from "@/lib/guest";

const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
});

const officialCatalog = new Map(
  [...venueClasses.map((item) => ({ ...item, mode: "VENUE" as const })),
   ...livestreamPackages.map((item) => ({ ...item, mode: "LIVESTREAM" as const }))]
    .map((item) => [`${item.mode}:${item.name}`, item]),
);

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
    await db()`SELECT id,password_hash FROM users WHERE email=${email} AND is_demo=${demo} AND (${demo}=false OR role='CUSTOMER')`;
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
  const role = z.enum(["customer", "admin", "finance"]).parse(form.get("role"));
  if (role !== "customer") {
    const expected = process.env.DEMO_ADMIN_CODE ?? "";
    const supplied = String(form.get("accessCode") ?? "");
    const valid = expected.length > 0 && supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
    if (!valid) throw new Error("Kode akses demo tidak valid.");
  }
  const [user] = role === "customer"
    ? await db()`INSERT INTO users(email,name,password_hash,role,is_demo)
        VALUES (${demoCustomerEmail()},'Demo Customer',${await hash(randomBytes(48).toString("base64url"), 12)},'CUSTOMER',true)
        RETURNING id`
    : await db()`SELECT id FROM users WHERE email=${DEMO_ACCOUNTS[role]} AND is_demo=true`;
  if (!user) throw new Error("Akun demo tidak tersedia.");
  await createSession(user.id);
  const next = form.get("next");
  redirect(role === "customer" && next === "/checkout" ? "/checkout" : role === "customer" ? "/account" : "/admin");
}

export async function logout() {
  await endSession();
  redirect("/");
}

const claimRequest = z.object({
  channel: z.enum(["WHATSAPP", "EMAIL"]),
  scope: z.enum(["TICKET", "LIVESTREAM"]),
  destination: z.string().trim().min(5).max(254),
});

export async function requestClaim(form: FormData) {
  const values = claimRequest.parse(Object.fromEntries(form));
  const destination = values.channel === "WHATSAPP"
    ? normalizePhone(values.destination)
    : z.email().parse(values.destination).toLowerCase();
  const destinationHash = tokenDigest(destination);
  if (values.channel === "EMAIL" && values.scope === "TICKET") {
    const orders = await db()`SELECT id FROM orders WHERE lower(buyer_email)=${destination} AND status='CONFIRMED' AND is_demo=${demoModeEnabled()} AND EXISTS (SELECT 1 FROM order_items i JOIN ticket_classes c ON c.id=i.class_id WHERE i.order_id=orders.id AND c.mode='VENUE')`;
    for (const order of orders)
      await db()`INSERT INTO delivery_jobs(order_id,channel,kind,recipient,status) VALUES (${order.id},'EMAIL','TICKET_RESEND',${destination},${demoModeEnabled() ? "SIMULATED" : "PENDING"}) ON CONFLICT DO UPDATE SET status=excluded.status,next_attempt_at=now(),updated_at=now()`;
    redirect("/claim-ticket?sent=1");
  }
  const [recent] = await db()`SELECT created_at FROM claim_otps WHERE destination_hash=${destinationHash} AND channel=${values.channel} AND scope=${values.scope} ORDER BY created_at DESC LIMIT 1`;
  if (recent && Date.now() - new Date(recent.created_at).getTime() < 60_000)
    redirect("/claim-ticket?cooldown=1");
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await db().begin(async (tx) => {
    await tx`UPDATE claim_otps SET used_at=now() WHERE destination_hash=${destinationHash} AND channel=${values.channel} AND scope=${values.scope} AND used_at IS NULL`;
    await tx`INSERT INTO claim_otps(destination_hash,channel,scope,code_hash,expires_at) VALUES (${destinationHash},${values.channel},${values.scope},${await hash(code, 12)},now()+interval '5 minutes')`;
    const orders = await tx`SELECT id FROM orders WHERE status='CONFIRMED' AND is_demo=${demoModeEnabled()} AND (${values.channel}='WHATSAPP' AND buyer_phone=${destination} OR ${values.channel}='EMAIL' AND lower(buyer_email)=${destination})`;
    for (const order of orders)
      await tx`INSERT INTO delivery_jobs(order_id,channel,kind,recipient,status,payload) VALUES (${order.id},${values.channel},${`${values.scope}_OTP`},${destination},${demoModeEnabled() ? "SIMULATED" : "PENDING"},${JSON.stringify({ code, expiresInMinutes: 5 })}::jsonb) ON CONFLICT DO UPDATE SET status=excluded.status,payload=excluded.payload,next_attempt_at=now(),updated_at=now()`;
  });
  redirect(`/claim-ticket?otp=1&channel=${values.channel}&scope=${values.scope}${demoModeEnabled() ? `&demoCode=${code}` : ""}`);
}

export async function verifyClaim(form: FormData) {
  const values = claimRequest.extend({ code: z.string().regex(/^\d{6}$/) }).parse(Object.fromEntries(form));
  const destination = values.channel === "WHATSAPP" ? normalizePhone(values.destination) : z.email().parse(values.destination).toLowerCase();
  const destinationHash = tokenDigest(destination);
  const [otp] = await db()`SELECT id,code_hash,attempts FROM claim_otps WHERE destination_hash=${destinationHash} AND channel=${values.channel} AND scope=${values.scope} AND used_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1`;
  if (!otp || otp.attempts >= 5 || !(await compare(values.code, otp.code_hash))) {
    if (otp) await db()`UPDATE claim_otps SET attempts=attempts+1 WHERE id=${otp.id}`;
    throw new Error("Kode tidak valid atau sudah kedaluwarsa.");
  }
  const token = newGuestToken();
  await db().begin(async (tx) => {
    await tx`UPDATE claim_otps SET used_at=now() WHERE id=${otp.id}`;
    await tx`INSERT INTO claim_sessions(token_hash,destination_hash,scope,expires_at) VALUES (${tokenDigest(token)},${destinationHash},${values.scope},now()+interval '30 minutes')`;
  });
  (await cookies()).set("sof_claim", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 1800 });
  redirect(values.scope === "LIVESTREAM" ? "/livestream" : "/claim-ticket?verified=1");
}

export async function reserve(form: FormData) {
  const demo = demoModeEnabled();
  const buyer = z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(8).max(30),
    email: z.preprocess((value) => value === "" ? undefined : value, z.email().max(254).optional()),
  }).parse({ name: form.get("name"), phone: form.get("phone"), email: form.get("email") });
  const phone = normalizePhone(buyer.phone);
  const email = buyer.email?.toLowerCase() ?? null;
  const guestToken = newGuestToken();
  await expireReservations();
  const [instructions] =
    await db()`SELECT value FROM site_settings WHERE key='payment_instructions'`;
  const payment = settingValue<{
    bank: string;
    account: string;
    holder: string;
  }>(instructions?.value);
  if (!demo && (!payment?.bank || !payment.account || !payment.holder))
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
  let createdOrderId = "";
  await sql.begin(async (tx) => {
    const [previous] =
      await tx`SELECT id,guest_token_hash FROM orders WHERE idempotency_key=${key}`;
    if (previous) {
      createdOrderId = previous.id;
      await tx`UPDATE orders SET guest_token_hash=${tokenDigest(guestToken)} WHERE id=${previous.id}`;
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
      const official = officialCatalog.get(`${ticketClass.mode}:${ticketClass.name}`);
      if (!official || Number(ticketClass.price) !== official.price)
        throw new Error("Katalog tiket tidak sesuai konfigurasi resmi.");
      if (
        ticketClass.mode === "VENUE" &&
        Number(ticketClass.capacity) !== Number("capacity" in official ? official.capacity : 0)
      )
        throw new Error("Kapasitas tiket tidak sesuai konfigurasi resmi.");
      if (ticketClass.mode === "LIVESTREAM" && !ticketClass.streaming_ready)
        throw new Error("Akses livestream belum tersedia.");
      if (ticketClass.mode === "LIVESTREAM") {
        if (ticketClass.purchase_limit !== null) {
          const [usage] = await tx`SELECT coalesce(sum(i.quantity),0)::integer AS total FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.class_id=${item.classId} AND o.is_demo=${demo} AND o.status IN ('PENDING','PAYMENT_REVIEW','CONFIRMED')`;
          if (item.quantity + Number(usage.total) > Number(ticketClass.purchase_limit))
            throw new Error("Batas paket livestream sudah tercapai.");
        }
      }
      let ticketIds: string[] = [];
      if (ticketClass.mode === "VENUE") {
        const rows =
          await tx`SELECT id FROM ticket_inventory WHERE class_id=${item.classId} AND status='AVAILABLE' AND is_demo=${demo} ORDER BY id FOR UPDATE SKIP LOCKED LIMIT ${item.quantity}`;
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
    if (prepared.some((item) => item.mode === "LIVESTREAM") && !email)
      throw new Error("Email wajib untuk pesanan livestream.");
    const total = cartTotal(prepared);
    const [order] =
      await tx`INSERT INTO orders(user_id,idempotency_key,total,expires_at,is_demo,buyer_name,buyer_phone,buyer_email,guest_token_hash) VALUES (NULL,${key},${total},now()+interval '24 hours',${demo},${buyer.name},${phone},${email},${tokenDigest(guestToken)}) RETURNING id`;
    createdOrderId = order.id;
    for (const item of prepared) {
      const [orderItem] =
        await tx`INSERT INTO order_items(order_id,class_id,quantity,unit_price) VALUES (${order.id},${item.classId},${item.quantity},${item.price}) RETURNING id`;
      for (const ticketId of item.ticketIds)
        allocations.push({ itemId: orderItem.id, ticketId });
      if (item.mode === "LIVESTREAM")
        await tx`INSERT INTO stream_entitlements(user_id,event_id,order_id) VALUES (NULL,${item.eventId},${order.id}) ON CONFLICT DO NOTHING`;
    }
    for (const allocation of allocations) {
      await tx`UPDATE ticket_inventory SET status='RESERVED' WHERE id=${allocation.ticketId}`;
      await tx`INSERT INTO ticket_allocations(ticket_id,item_id) VALUES (${allocation.ticketId},${allocation.itemId})`;
    }
  });
  await setGuestOrderToken(guestToken);
  redirect(`/orders/${createdOrderId}`);
}

export async function simulateDemoPayment(form: FormData) {
  requireDemoMode();
  const user = await currentUser();
  const tokenHash = await guestOrderTokenHash();
  if (user && !user.is_demo) throw new Error("Akun ini bukan akun demo.");
  const orderId = z.uuid().parse(form.get("orderId"));
  const outcome = z.enum(["SUCCESS", "FAILED", "CANCELLED"]).parse(form.get("outcome"));
  const result = await db().begin(async (tx) => {
    const [order] = await tx`SELECT id,user_id,status,total,expires_at,buyer_phone,buyer_email FROM orders WHERE id=${orderId} AND is_demo=true AND ((${user?.id ?? null}::uuid IS NOT NULL AND user_id=${user?.id ?? null}) OR (${tokenHash}::text IS NOT NULL AND guest_token_hash=${tokenHash})) FOR UPDATE`;
    if (!order) throw new Error("Pesanan demo tidak ditemukan.");
    const [existing] = await tx`SELECT outcome FROM demo_payments WHERE order_id=${orderId}`;
    if (existing) {
      if (existing.outcome !== outcome) throw new Error("Hasil pembayaran demo sudah ditetapkan.");
      return { expired: false };
    }
    if (order.status !== "PENDING") throw new Error("Pesanan demo sudah diproses.");
    if (!reservationIsActive(order.status, order.expires_at)) {
      await tx`UPDATE orders SET status='EXPIRED' WHERE id=${orderId}`;
      await tx`UPDATE ticket_inventory SET status='AVAILABLE' WHERE is_demo=true AND id IN (SELECT a.ticket_id FROM ticket_allocations a JOIN order_items i ON i.id=a.item_id WHERE i.order_id=${orderId})`;
      await tx`DELETE FROM ticket_allocations WHERE item_id IN (SELECT id FROM order_items WHERE order_id=${orderId})`;
      await tx`UPDATE stream_entitlements SET active=false WHERE order_id=${orderId}`;
      await tx`INSERT INTO order_status_history(order_id,actor_id,from_status,to_status) VALUES (${orderId},${user?.id ?? null},'PENDING','EXPIRED')`;
      return { expired: true };
    }
    await tx`INSERT INTO demo_payments(order_id,outcome,receipt_label) VALUES (${orderId},${outcome},'SIMULATED')`;
    if (outcome === "SUCCESS") {
      await tx`UPDATE orders SET status='CONFIRMED' WHERE id=${orderId}`;
      await tx`UPDATE ticket_inventory SET status='SOLD' WHERE is_demo=true AND id IN (SELECT a.ticket_id FROM ticket_allocations a JOIN order_items i ON i.id=a.item_id WHERE i.order_id=${orderId})`;
      await tx`UPDATE stream_entitlements SET active=true WHERE order_id=${orderId}`;
      const tickets = await tx`SELECT t.id,c.name FROM ticket_inventory t JOIN ticket_allocations a ON a.ticket_id=t.id JOIN order_items i ON i.id=a.item_id JOIN ticket_classes c ON c.id=i.class_id WHERE i.order_id=${orderId}`;
      const message = {
        simulated: true,
        title: "Pembayaran demo berhasil",
        body: `Pesanan #${String(orderId).slice(0, 8)} telah dikonfirmasi.`,
        tickets: tickets.map((ticket) => ({
          name: ticket.name,
          url: `/api/tickets/${ticket.id}`,
        })),
      };
      await tx`INSERT INTO notification_outbox(order_id,kind,status,user_id,recipient,demo_message) VALUES (${orderId},'PAYMENT_CONFIRMED','SIMULATED_DELIVERED',${user?.id ?? null},'DEMO ONLY',${JSON.stringify(message)}::jsonb) ON CONFLICT(order_id,kind) DO NOTHING`;
      if (order.buyer_phone) await tx`INSERT INTO delivery_jobs(order_id,channel,kind,recipient,status) VALUES (${orderId},'WHATSAPP','ORDER_FULFILLMENT',${order.buyer_phone},'SIMULATED') ON CONFLICT DO NOTHING`;
      if (order.buyer_email) await tx`INSERT INTO delivery_jobs(order_id,channel,kind,recipient,status) VALUES (${orderId},'EMAIL','ORDER_FULFILLMENT',${order.buyer_email},'SIMULATED') ON CONFLICT DO NOTHING`;
      await tx`INSERT INTO order_status_history(order_id,actor_id,from_status,to_status) VALUES (${orderId},${user?.id ?? null},'PENDING','CONFIRMED')`;
    } else {
      const status = outcome === "FAILED" ? "FAILED" : "CANCELLED";
      await tx`UPDATE orders SET status=${status} WHERE id=${orderId}`;
      await tx`UPDATE ticket_inventory SET status='AVAILABLE' WHERE is_demo=true AND id IN (SELECT a.ticket_id FROM ticket_allocations a JOIN order_items i ON i.id=a.item_id WHERE i.order_id=${orderId})`;
      await tx`DELETE FROM ticket_allocations WHERE item_id IN (SELECT id FROM order_items WHERE order_id=${orderId})`;
      await tx`UPDATE stream_entitlements SET active=false WHERE order_id=${orderId}`;
      await tx`INSERT INTO order_status_history(order_id,actor_id,from_status,to_status) VALUES (${orderId},${user?.id ?? null},'PENDING',${status})`;
    }
    await tx`INSERT INTO audit_logs(actor_id,action,resource_id,details) VALUES (${user?.id ?? null},'DEMO_PAYMENT',${orderId},${JSON.stringify({ outcome, simulated: true })}::jsonb)`;
    return { expired: false };
  });
  if (result.expired) throw new Error("Reservasi demo sudah kedaluwarsa. Stok telah dipulihkan.");
  redirect(`/orders/${orderId}?payment=${outcome.toLowerCase()}`);
}

export async function submitDemoDonation(form: FormData) {
  requireDemoMode();
  const user = await currentUser();
  if (user && !user.is_demo) throw new Error("Akun ini bukan akun demo.");
  const amount = z.coerce.number().int().min(10000).max(100000000).parse(form.get("amount"));
  const name = z.string().trim().min(2).max(100).parse(form.get("name"));
  const key = z.uuid().parse(form.get("idempotencyKey"));
  const tier = z.string().trim().min(2).max(100).optional().parse(form.get("tier") || undefined);
  const officialTier = tier
    ? contributionTiers.find((item) => item.name === tier && item.price === amount)
    : undefined;
  if (tier && !officialTier) throw new Error("Paket kontribusi tidak valid.");
  const reference = `DEMO-DONATION-${key}`;
  const [campaign] = await db()`SELECT id FROM donation_campaigns ORDER BY id LIMIT 1`;
  const [donation] = await db()`INSERT INTO donations(campaign_id,user_id,donor_name,amount,contribution_tier,payment_reference,bank_reference,anonymous,status,verified_at,is_demo)
    VALUES (${campaign.id},${user?.id ?? null},${name},${amount},${tier ?? null},${reference},${`SIMULATED-${key}`},${form.get("anonymous") === "on"},'VERIFIED',now(),true)
    ON CONFLICT(payment_reference) DO UPDATE SET payment_reference=excluded.payment_reference RETURNING id`;
  redirect(`/donations/${donation.id}?demo=1`);
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
  const demo = demoModeEnabled();
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
      await tx`SELECT id,user_id,status,expires_at,total FROM orders WHERE id=${id} AND is_demo=${demo} FOR UPDATE`;
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
  const tier = z.string().trim().min(2).max(100).optional().parse(form.get("tier") || undefined);
  const officialTier = tier
    ? contributionTiers.find((item) => item.name === tier && item.price === amount)
    : undefined;
  if (tier && !officialTier) throw new Error("Paket kontribusi tidak valid.");
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
    await db()`INSERT INTO donations(campaign_id,donor_name,amount,contribution_tier,payment_reference,anonymous) VALUES (${campaign.id},${name},${amount},${tier ?? null},${reference},${form.get("anonymous") === "on"}) RETURNING id`;
  redirect(`/donations/${donation.id}`);
}

export async function verifyTicket(form: FormData) {
  const admin = await requireAdmin();
  const demo = demoModeEnabled();
  const id = z.uuid().parse(form.get("ticketId"));
  await db().begin(async (tx) => {
    const [ticket] =
      await tx`SELECT t.id,t.class_id,t.status,c.capacity FROM ticket_inventory t JOIN ticket_classes c ON c.id=t.class_id WHERE t.id=${id} AND t.is_demo=${demo} FOR UPDATE OF t,c`;
    if (!ticket || ticket.status !== "NEEDS_REVIEW")
      throw new Error("Tiket tidak dapat diverifikasi.");
    const [counts] =
      await tx`SELECT count(*)::integer AS total FROM ticket_inventory WHERE class_id=${ticket.class_id} AND status IN ('AVAILABLE','RESERVED','SOLD') AND is_demo=${demo}`;
    if (counts.total >= ticket.capacity)
      throw new Error("Kapasitas resmi sudah penuh.");
    await tx`UPDATE ticket_inventory SET status='AVAILABLE',verified_at=now() WHERE id=${id}`;
    await tx`INSERT INTO ticket_status_history(ticket_id,actor_id,from_status,to_status) VALUES (${id},${admin.id},'NEEDS_REVIEW','AVAILABLE')`;
  });
  redirect("/admin");
}

export async function verifyDonation(form: FormData) {
  const admin = await requireFinance();
  const demo = demoModeEnabled();
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
      await tx`SELECT amount FROM donations WHERE id=${id} AND status='PENDING' AND expires_at>now() AND payment_reference IS NOT NULL AND is_demo=${demo} FOR UPDATE`;
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

export async function setDemoStreamState(form: FormData) {
  requireDemoMode();
  const admin = await requireStreamOperator();
  const state = z.enum(["NOT_STARTED", "LIVE", "ENDED"]).parse(form.get("state"));
  const value = JSON.stringify({
    state,
    demo: true,
    sampleUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  });
  await db().begin(async (tx) => {
    await tx`INSERT INTO site_settings(key,value) VALUES ('stream',${value}::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value`;
    await tx`UPDATE events SET streaming_ready=true`;
    await tx`INSERT INTO audit_logs(actor_id,action,resource_id,details) VALUES (${admin.id},'DEMO_STREAM_STATE','stream',${JSON.stringify({ state, simulated: true })}::jsonb)`;
  });
  redirect("/admin#stream");
}

export async function updateLivestreamOperations(form: FormData) {
  const operator = await requireStreamOperator();
  const provider = z.enum(["simulation", "youtube", "cloudflare"]).parse(form.get("provider"));
  const state = z.enum(broadcastStates).parse(form.get("state"));
  const source = z.string().trim().max(500).optional().parse(form.get("videoSource") || undefined);
  let videoId = source;
  if (provider === "youtube" && source) {
    const match = source.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|live\/))([A-Za-z0-9_-]{11})/) || source.match(/^([A-Za-z0-9_-]{11})$/);
    if (!match) throw new Error("URL atau ID YouTube tidak valid.");
    videoId = match[1];
  }
  const scheduledStart = z.iso.datetime({ offset: true }).parse(form.get("scheduledStart"));
  const scheduledEnd = z.iso.datetime({ offset: true }).parse(form.get("scheduledEnd"));
  if (Date.parse(scheduledEnd) <= Date.parse(scheduledStart)) throw new Error("Waktu selesai harus setelah waktu mulai.");
  const sessionLimit = z.coerce.number().int().min(1).max(5).parse(form.get("sessionLimit"));
  const maintenanceMessage = z.string().trim().max(300).parse(form.get("maintenanceMessage") || "");
  const [existing] = await db()`SELECT value FROM site_settings WHERE key='stream'`;
  const current = normalizeStreamConfig(settingValue(existing?.value));
  const value = { ...current, provider, state, videoId, scheduledStart, scheduledEnd, sessionLimit, maintenanceMessage, viewerAccess: form.get("viewerAccess") === "on" };
  await db().begin(async (tx) => {
    await tx`INSERT INTO site_settings(key,value) VALUES ('stream',${JSON.stringify(value)}::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value`;
    await tx`UPDATE events SET streaming_ready=${Boolean(videoId || provider === "simulation")}`;
    if (!value.viewerAccess || ["ENDED", "NOT_STARTED"].includes(state)) await tx`UPDATE stream_viewer_sessions SET active=false,ended_at=now() WHERE active=true`;
    await tx`INSERT INTO audit_logs(actor_id,action,resource_id,details) VALUES (${operator.id},'UPDATE_LIVESTREAM_OPERATIONS','stream',${JSON.stringify({ provider, state, viewerAccess: value.viewerAccess, sessionLimit })}::jsonb)`;
  });
  redirect("/admin/livestream?saved=1");
}

export async function revokeStreamEntitlement(form: FormData) {
  const operator = await requireStreamOperator();
  const id = z.uuid().parse(form.get("entitlementId"));
  await db().begin(async (tx) => {
    const [row] = await tx`UPDATE stream_entitlements SET active=false,revoked_at=now(),revoked_by=${operator.id} WHERE id=${id} RETURNING user_id,event_id`;
    if (!row) throw new Error("Hak akses tidak ditemukan.");
    await tx`UPDATE stream_viewer_sessions SET active=false,ended_at=now() WHERE user_id=${row.user_id} AND event_id=${row.event_id} AND active=true`;
    await tx`INSERT INTO audit_logs(actor_id,action,resource_id) VALUES (${operator.id},'REVOKE_STREAM_ENTITLEMENT',${id})`;
  });
  redirect("/admin/livestream");
}

export async function endViewerSession(form: FormData) {
  const operator = await requireStreamOperator();
  const id = z.uuid().parse(form.get("sessionId"));
  await db().begin(async (tx) => {
    await tx`UPDATE stream_viewer_sessions SET active=false,ended_at=now() WHERE id=${id}`;
    await tx`INSERT INTO audit_logs(actor_id,action,resource_id) VALUES (${operator.id},'END_STREAM_VIEWER_SESSION',${id})`;
  });
  redirect("/admin/livestream");
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
        await tx`SELECT count(*)::integer AS total FROM ticket_inventory WHERE class_id=${id} AND status='AVAILABLE' AND is_demo=${demoModeEnabled()}`;
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
  const admin = await requireCheckIn();
  const demo = demoModeEnabled();
  const barcode = z.string().trim().min(3).max(512).parse(form.get("barcode"));
  await db().begin(async (tx) => {
    const [ticket] =
      await tx`SELECT t.id,t.status,o.status AS order_status FROM ticket_inventory t JOIN ticket_allocations a ON a.ticket_id=t.id JOIN order_items i ON i.id=a.item_id JOIN orders o ON o.id=i.order_id WHERE t.barcode=${barcode} AND t.is_demo=${demo} AND o.is_demo=${demo} FOR UPDATE OF t`;
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
  const role = z.enum(["CUSTOMER", "FINANCE", "CHECK_IN", "STREAM_OPERATOR", "ADMIN"]).parse(form.get("role"));
  if (userId === admin.id && role !== "ADMIN")
    throw new Error("Anda tidak dapat menurunkan peran akun sendiri.");
  await db().begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(427312)`;
    const [target] =
      await tx`SELECT role FROM users WHERE id=${userId} AND is_demo=${demoModeEnabled()} FOR UPDATE`;
    if (!target) throw new Error("Pengguna tidak ditemukan.");
    if (target.role === "ADMIN" && role !== "ADMIN") {
      const [count] =
        await tx`SELECT count(*)::integer AS total FROM users WHERE role='ADMIN' AND is_demo=${demoModeEnabled()}`;
      if (count.total <= 1)
        throw new Error("Admin terakhir tidak dapat diturunkan.");
    }
    await tx`UPDATE users SET role=${role} WHERE id=${userId}`;
    await tx`INSERT INTO audit_logs(actor_id,action,resource_id,details) VALUES (${admin.id},'SET_USER_ROLE',${userId},${JSON.stringify({ from: target.role, to: role })}::jsonb)`;
  });
  redirect("/admin#users");
}

export async function resetDemoDataAction() {
  requireDemoMode();
  await requireAdmin();
  await resetDemoData();
  redirect("/admin?demoReset=1");
}
