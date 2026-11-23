import assert from "node:assert/strict";
import test from "node:test";
import { demoModeEnabled } from "../lib/demo-config.ts";

test("demo mode stays disabled without an explicit flag", () => {
  assert.equal(demoModeEnabled({
    NODE_ENV: "development",
  }), false);
});

test("demo mode is available in preview when explicitly enabled", () => {
  assert.equal(demoModeEnabled({
    DEMO_MODE: "true",
    NODE_ENV: "production",
    VERCEL_ENV: "preview",
  }), true);
});

test("demo mode can never activate in Vercel production", () => {
  assert.equal(demoModeEnabled({
    DEMO_MODE: "true",
    DEMO_LOCAL: "true",
    NODE_ENV: "production",
    VERCEL_ENV: "production",
  }), false);
});

test("local production builds require a second explicit opt-in", () => {
  assert.equal(demoModeEnabled({
    DEMO_MODE: "true",
    NODE_ENV: "production",
  }), false);

  assert.equal(demoModeEnabled({
    DEMO_MODE: "true",
    DEMO_LOCAL: "true",
    NODE_ENV: "production",
  }), true);
});
