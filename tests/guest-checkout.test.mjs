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
