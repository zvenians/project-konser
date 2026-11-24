import test from "node:test";
import assert from "node:assert/strict";
import { resolveDatabaseUrl } from "../lib/database-target.ts";
import { hasCapability } from "../lib/permissions.ts";
import { cartTotal, reservationIsActive } from "../lib/transactions.ts";

test("demo and production databases are isolated", () => {
  const production = "postgres://prod";
  const demo = "postgres://demo";
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: production, DEMO_MODE: "false" }), production);
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: production, DEMO_DATABASE_URL: demo, DEMO_MODE: "true", NODE_ENV: "test" }), demo);
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

test("expired reservations cannot be paid", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  assert.equal(reservationIsActive("PENDING", "2026-11-24T12:01:00Z", now), true);
  assert.equal(reservationIsActive("PENDING", "2026-11-24T11:59:00Z", now), false);
  assert.equal(reservationIsActive("CONFIRMED", "2026-11-24T12:01:00Z", now), false);
});
