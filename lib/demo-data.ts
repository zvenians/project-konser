import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { TransactionSql } from "postgres";
import { db } from "./db";
import { requireDemoMode } from "./demo-config";
import { livestreamPackages, venueClasses } from "./event";

export const DEMO_ACCOUNTS = {
  customer: "customer@demo.symphonyoffaith.local",
  admin: "admin@demo.symphonyoffaith.local",
  finance: "finance@demo.symphonyoffaith.local",
} as const;

const stockByClass = new Map(
  venueClasses.map((ticketClass) => [ticketClass.name, ticketClass.capacity]),
);

async function reconcileDemoInventory(
  tx: TransactionSql,
  ticketClass: { id: string; name: string },
  target: number,
) {
  const [before] = await tx`
    SELECT
      count(*) FILTER (WHERE status <> 'VOIDED')::integer AS active,
      count(*) FILTER (WHERE status = 'AVAILABLE')::integer AS available
    FROM ticket_inventory
    WHERE class_id=${ticketClass.id} AND is_demo=true
  `;
  const active = Number(before.active);
  const surplus = active - target;

  if (surplus > Number(before.available)) {
    throw new Error(
      `Inventaris demo ${ticketClass.name} melebihi kapasitas dan berisi tiket yang sudah diterbitkan.`,
    );
  }

  if (surplus > 0) {
    await tx`
      WITH surplus AS (
        SELECT id
        FROM ticket_inventory
        WHERE class_id=${ticketClass.id} AND is_demo=true AND status='AVAILABLE'
        ORDER BY id
        LIMIT ${surplus}
        FOR UPDATE
      ), voided AS (
        UPDATE ticket_inventory AS inventory
        SET status='VOIDED'
        FROM surplus
        WHERE inventory.id=surplus.id
        RETURNING inventory.id
      )
      INSERT INTO ticket_status_history(ticket_id,from_status,to_status)
      SELECT id,'AVAILABLE','VOIDED' FROM voided
    `;
  }

  const [current] = await tx`
    SELECT count(*) FILTER (WHERE status <> 'VOIDED')::integer AS active
    FROM ticket_inventory
    WHERE class_id=${ticketClass.id} AND is_demo=true
  `;
  const missing = target - Number(current.active);
  if (missing <= 0) return;

  await tx`INSERT INTO ticket_inventory(class_id,file_key,file_hash,barcode,status,verified_at,original_name,is_demo)
    SELECT ${ticketClass.id},'demo://' || token || '.pdf','demo-' || token,'SOF-DEMO:' || token,'AVAILABLE',now(),${`Symphony-of-Faith-${ticketClass.name}-DEMO.pdf`},true
    FROM (SELECT gen_random_uuid()::text AS token FROM generate_series(1,${missing})) generated`;
}

async function ensureAccounts() {
  const sql = db();
  const existing =
    await sql`SELECT email FROM users WHERE email = ANY(${Object.values(DEMO_ACCOUNTS)})`;
  if (existing.length === 3) return;
  for (const account of [
    [DEMO_ACCOUNTS.customer, "Demo Customer", "CUSTOMER"],
    [DEMO_ACCOUNTS.admin, "Demo Administrator", "ADMIN"],
    [DEMO_ACCOUNTS.finance, "Demo Finance", "FINANCE"],
  ] as const) {
    const passwordHash = await hash(randomBytes(48).toString("base64url"), 12);
    await sql`INSERT INTO users(email,name,password_hash,role,is_demo) VALUES (${account[0]},${account[1]},${passwordHash},${account[2]},true) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,is_demo=true`;
  }
}

export async function ensureDemoData() {
  requireDemoMode();
  const sql = db();
  const [ready] = await sql`SELECT
    NOT EXISTS (
      SELECT 1 FROM (VALUES
        ('VVIP',77),('VIP',77),('GOLD',177),('SILVER',577),('REGULER',777)
      ) AS expected(name,capacity)
      LEFT JOIN ticket_classes c ON c.name=expected.name AND c.mode='VENUE'
      LEFT JOIN LATERAL (
        SELECT count(*)::integer AS total FROM ticket_inventory t
        WHERE t.class_id=c.id AND t.is_demo=true AND t.status<>'VOIDED'
      ) actual ON true
      WHERE c.id IS NULL OR coalesce(actual.total,0)<>expected.capacity
    ) AS inventory_ready,
    (SELECT count(*) FROM users WHERE email = ANY(${Object.values(DEMO_ACCOUNTS)}) AND is_demo=true)=3 AS accounts_ready,
    EXISTS(SELECT 1 FROM orders WHERE idempotency_key='00000000-0000-4000-8000-000000000027') AS history_ready`;
  if (ready.inventory_ready && ready.accounts_ready && ready.history_ready)
    return;
  await ensureAccounts();
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(762027)`;
    await tx`UPDATE ticket_classes SET sale_enabled=true`;
    await tx`UPDATE events SET streaming_ready=true`;
    await tx`INSERT INTO site_settings(key,value) VALUES ('stream',${JSON.stringify({ state: "LIVE", demo: true, sampleUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" })}::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value`;

    const classes =
      await tx`SELECT id,name FROM ticket_classes WHERE mode='VENUE'`;
    const classesByName = new Map(
      classes.map((ticketClass) => [String(ticketClass.name), ticketClass]),
    );
    for (const [name, target] of stockByClass) {
      const ticketClass = classesByName.get(name);
      if (!ticketClass) {
        throw new Error(
          `Katalog tiket ${name} belum tersedia. Jalankan migrasi 012-official-catalog.sql.`,
        );
      }
      await reconcileDemoInventory(
        tx,
        { id: String(ticketClass.id), name },
        target,
      );
    }

    const [customer] =
      await tx`SELECT id FROM users WHERE email=${DEMO_ACCOUNTS.customer}`;
    const [finance] =
      await tx`SELECT id FROM users WHERE email=${DEMO_ACCOUNTS.finance}`;
    const [event] = await tx`SELECT id FROM events ORDER BY starts_at LIMIT 1`;
    const [liveClass] =
      await tx`SELECT id,price FROM ticket_classes WHERE mode='LIVESTREAM' AND name='Simfoni Agung' LIMIT 1`;
    const availableLivestreams = await tx`
      SELECT name FROM ticket_classes
      WHERE mode='LIVESTREAM' AND name = ANY(${livestreamPackages.map((item) => item.name)})
    `;
    if (
      availableLivestreams.length !== livestreamPackages.length ||
      !liveClass
    ) {
      throw new Error(
        "Katalog livestream belum lengkap. Jalankan migrasi 012-official-catalog.sql.",
      );
    }
    const historicalKey = "00000000-0000-4000-8000-000000000027";
    const [historical] =
      await tx`INSERT INTO orders(user_id,idempotency_key,status,total,expires_at,is_demo,demo_historical)
      VALUES (${finance.id},${historicalKey},'CONFIRMED',${liveClass.price},now()+interval '365 days',true,true)
      ON CONFLICT(idempotency_key) DO UPDATE SET status='CONFIRMED',user_id=excluded.user_id RETURNING id`;
    await tx`INSERT INTO order_items(order_id,class_id,quantity,unit_price) VALUES (${historical.id},${liveClass.id},1,${liveClass.price}) ON CONFLICT(order_id,class_id) DO NOTHING`;
    await tx`DELETE FROM stream_entitlements WHERE order_id=${historical.id}`;
    await tx`INSERT INTO stream_entitlements(user_id,event_id,order_id,active) VALUES (${finance.id},${event.id},${historical.id},true) ON CONFLICT(user_id,event_id,order_id) DO UPDATE SET active=true`;
    await tx`INSERT INTO demo_payments(order_id,outcome) VALUES (${historical.id},'SUCCESS') ON CONFLICT(order_id) DO NOTHING`;
    await tx`INSERT INTO notification_outbox(order_id,kind,status,user_id,recipient,demo_message)
      VALUES (${historical.id},'PAYMENT_CONFIRMED','SIMULATED_DELIVERED',${finance.id},'DEMO ONLY',${JSON.stringify({ title: "Pembayaran demo berhasil", body: "Pesanan livestream demo telah dikonfirmasi.", simulated: true })}::jsonb)
      ON CONFLICT(order_id,kind) DO NOTHING`;

    const [campaign] =
      await tx`SELECT id FROM donation_campaigns ORDER BY id LIMIT 1`;
    await tx`INSERT INTO donations(id,campaign_id,user_id,donor_name,anonymous,amount,status,payment_reference,bank_reference,verified_at,is_demo,demo_historical)
      VALUES ('00000000-0000-4000-8000-000000000127',${campaign.id},${customer.id},'Sahabat Symphony',false,250000,'VERIFIED','DEMO-HISTORY-DONATION','SIMULATED',now(),true,true)
      ON CONFLICT(id) DO NOTHING`;
  });
}

export async function resetDemoData() {
  requireDemoMode();
  const sql = db();
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(762027)`;
    await tx`DELETE FROM ticket_checkins WHERE ticket_id IN (SELECT id FROM ticket_inventory WHERE is_demo=true)`;
    await tx`DELETE FROM notification_outbox WHERE order_id IN (SELECT id FROM orders WHERE is_demo=true)`;
    await tx`DELETE FROM demo_payments WHERE order_id IN (SELECT id FROM orders WHERE is_demo=true)`;
    await tx`DELETE FROM bank_receipts WHERE source_id IN (SELECT id FROM orders WHERE is_demo=true) OR source_id IN (SELECT id FROM donations WHERE is_demo=true)`;
    await tx`DELETE FROM payment_claims WHERE order_id IN (SELECT id FROM orders WHERE is_demo=true)`;
    await tx`DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE is_demo=true)`;
    await tx`DELETE FROM stream_entitlements WHERE order_id IN (SELECT id FROM orders WHERE is_demo=true)`;
    await tx`DELETE FROM ticket_allocations WHERE ticket_id IN (SELECT id FROM ticket_inventory WHERE is_demo=true)`;
    await tx`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE is_demo=true)`;
    await tx`DELETE FROM orders WHERE is_demo=true`;
    await tx`DELETE FROM donations WHERE is_demo=true`;
    await tx`DELETE FROM ticket_status_history WHERE ticket_id IN (SELECT id FROM ticket_inventory WHERE is_demo=true)`;
    await tx`DELETE FROM ticket_inventory WHERE is_demo=true`;
  });
  await ensureDemoData();
}
