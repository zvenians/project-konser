import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveDatabaseUrl } from "../lib/database-target.ts";
import { hasCapability } from "../lib/permissions.ts";
import { cartTotal, reservationIsActive } from "../lib/transactions.ts";
import { demoCustomerEmail, regularLoginRoleAllowed } from "../lib/demo-identity.ts";

test("demo and production databases are isolated", () => {
  const production = "postgres://prod";
  const demo = "postgres://demo";
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: production, DEMO_MODE: "false" }), production);
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: production, DEMO_DATABASE_URL: demo, DEMO_MODE: "true", NODE_ENV: "test" }), demo);
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: production, DEMO_DATABASE_DATABASE_URL: demo, DEMO_MODE: "true", VERCEL_ENV: "preview" }), demo);
  assert.throws(() => resolveDatabaseUrl({ DATABASE_URL: production, DEMO_DATABASE_URL: production, DEMO_MODE: "true", NODE_ENV: "test" }));
});

test("staff capabilities follow least privilege", () => {
  assert.equal(hasCapability("ADMIN", "users"), true);
  assert.equal(hasCapability("FINANCE", "finance"), true);
  assert.equal(hasCapability("FINANCE", "users"), false);
  assert.equal(hasCapability("CHECK_IN", "checkin"), true);
  assert.equal(hasCapability("CHECK_IN", "finance"), false);
  assert.equal(hasCapability("STREAM_OPERATOR", "stream"), true);
  assert.equal(hasCapability("STREAM_OPERATOR", "inventory"), false);
});

test("mixed venue and livestream cart has one consistent total", () => {
  assert.equal(cartTotal([{ quantity: 2, price: 100000 }, { quantity: 1, price: 50000 }]), 250000);
});

test("homepage renders only one shared cart summary", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /cartOptions=\{\[\.\.\.venueOptions, \.\.\.streamOptions\]\}/);
  assert.equal((source.match(/showCart=\{false\}/g) || []).length, 1);
});

test("expired reservations cannot be paid", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  assert.equal(reservationIsActive("PENDING", "2026-11-24T12:01:00Z", now), true);
  assert.equal(reservationIsActive("PENDING", "2026-11-24T11:59:00Z", now), false);
  assert.equal(reservationIsActive("CONFIRMED", "2026-11-24T12:01:00Z", now), false);
});

test("demo customer identities are isolated per login", () => {
  const first = demoCustomerEmail("00000000-0000-4000-8000-000000000001");
  const second = demoCustomerEmail("00000000-0000-4000-8000-000000000002");
  assert.notEqual(first, second);
  assert.match(first, /^customer\+.+@demo\.symphonyoffaith\.local$/);
});

test("regular login cannot bypass demo staff access code", () => {
  assert.equal(regularLoginRoleAllowed(true, "ADMIN"), false);
  assert.equal(regularLoginRoleAllowed(true, "FINANCE"), false);
  assert.equal(regularLoginRoleAllowed(true, "CUSTOMER"), true);
  assert.equal(regularLoginRoleAllowed(false, "ADMIN"), true);
});

test("expired demo payment commits stock restoration before surfacing error", async () => {
  const source = await readFile(new URL("../app/actions.ts", import.meta.url), "utf8");
  const restore = source.indexOf("return { expired: true }");
  const afterCommitError = source.indexOf("if (result.expired) throw new Error");
  assert.ok(restore > 0);
  assert.ok(afterCommitError > restore);
});
