import assert from "node:assert/strict";
import test from "node:test";
import { demoTicketQrValue, demoTicketTitle } from "../lib/demo-ticket.ts";

test("demo ticket QR values are namespaced and stable", () => {
  assert.equal(
    demoTicketQrValue("11111111-1111-4111-8111-111111111111"),
    "SOF-DEMO:11111111-1111-4111-8111-111111111111",
  );
});

test("demo ticket title makes invalid-for-entry status explicit", () => {
  assert.equal(
    demoTicketTitle("Gold"),
    "Symphony of Faith — Gold — DEMO TICKET — NOT VALID FOR ENTRY",
  );
});
