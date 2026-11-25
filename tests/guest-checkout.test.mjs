import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("guest checkout collects required contact details without customer login", async () => {
  const checkout = await readFile(new URL("../components/checkout-cart.tsx", import.meta.url), "utf8");
  const actions = await readFile(new URL("../app/actions.ts", import.meta.url), "utf8");
  assert.match(checkout, /name="name"/);
  assert.match(checkout, /name="phone"/);
  assert.match(checkout, /required=\{selected\.some\(\(item\) => item\.mode === "LIVESTREAM"\)\}/);
  assert.doesNotMatch(actions.slice(actions.indexOf("export async function reserve"), actions.indexOf("export async function simulateDemoPayment")), /requireUser/);
});

test("claim OTPs are scoped, expiring, single use and attempt limited", async () => {
  const actions = await readFile(new URL("../app/actions.ts", import.meta.url), "utf8");
  assert.match(actions, /now\(\)\+interval '5 minutes'/);
  assert.match(actions, /otp\.attempts >= 5/);
  assert.match(actions, /UPDATE claim_otps SET used_at=now\(\)/);
  assert.match(actions, /sof_claim/);
});

test("Midtrans webhook verifies signature, server status and exact amount", async () => {
  const route = await readFile(new URL("../app/api/webhooks/midtrans/route.ts", import.meta.url), "utf8");
  assert.match(route, /createHash\("sha512"\)/);
  assert.match(route, /\/status/);
  assert.match(route, /Number\(order\.total\) !== amount/);
  assert.match(route, /ON CONFLICT DO NOTHING/);
});

test("paid guest can download only tickets allocated to the owned order", async () => {
  const route = await readFile(new URL("../app/api/tickets/[id]/route.ts", import.meta.url), "utf8");
  const access = await readFile(new URL("../lib/order-access.ts", import.meta.url), "utf8");
  assert.match(route, /guestOwnsTicket\(ticket\.order_id, id\)/);
  assert.match(access, /o\.guest_token_hash=\$\{tokenHash\}/);
  assert.match(access, /o\.status='CONFIRMED'/);
  assert.match(access, /a\.ticket_id=\$\{ticketId\}/);
});

test("success modal exposes ticket downloads, delivery state and livestream action", async () => {
  const modal = await readFile(new URL("../components/payment-success.tsx", import.meta.url), "utf8");
  assert.match(modal, /Unduh semua/);
  assert.match(modal, /Status pengiriman/);
  assert.match(modal, /href="\/livestream"/);
});

test("claim flow has persistent throttling, atomic verification and no public demo OTP", async () => {
  const actions = await readFile(new URL("../app/actions.ts", import.meta.url), "utf8");
  const claim = await readFile(new URL("../app/claim-ticket/page.tsx", import.meta.url), "utf8");
  const livestream = await readFile(new URL("../app/livestream/page.tsx", import.meta.url), "utf8");
  assert.match(actions, /claim_rate_limits/);
  assert.match(actions, /pg_advisory_xact_lock/);
  assert.match(actions, /FOR UPDATE/);
  assert.doesNotMatch(actions, /demoCode=/);
  assert.doesNotMatch(claim + livestream, /Kode simulasi/);
});

test("delivery worker supports WhatsApp documents, Brevo attachments and bounded retries", async () => {
  const worker = await readFile(new URL("../lib/delivery-worker.ts", import.meta.url), "utf8");
  const providers = await readFile(new URL("../lib/providers.ts", import.meta.url), "utf8");
  assert.match(worker, /sendDocument/);
  assert.match(worker, /attachments/);
  assert.match(worker, /attempts<5/);
  assert.match(providers, /api\.brevo\.com\/v3\/smtp\/email/);
});

test("livestream heartbeat is tied to entitlement and verified claim session", async () => {
  const route = await readFile(new URL("../app/api/livestream/access/route.ts", import.meta.url), "utf8");
  assert.match(route, /claim_session_id/);
  assert.match(route, /e\.active=true/);
  assert.match(route, /o\.status='CONFIRMED'/);
  assert.match(route, /SESSION_LIMIT_REACHED/);
});
