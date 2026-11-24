import assert from "node:assert/strict";
import { chromium } from "playwright";
import { browserContextOptions, browserLaunchOptions } from "./browser-launch.mjs";

const base = process.env.APP_URL ?? "http://localhost:3230";
const browser = await chromium.launch(browserLaunchOptions());
const page = await browser.newPage(browserContextOptions({ viewport: { width: 390, height: 844 } }));
try {
  await page.goto(`${base}/login`);
  await page.getByRole("button", { name: /Masuk sebagai Demo Customer/i }).click();
  await page.waitForURL("**/account");
  await page.goto(`${base}/#tickets`);
  const row = page.locator(".picker-row").filter({ hasText: "Silver" }).first();
  const before = Number((await row.innerText()).match(/(\d+) tersedia/)?.[1]);
  await row.getByRole("button", { name: "+ Silver" }).click();
  await page.locator(".mobile-cart-bar").getByRole("link").click();
  await page.getByRole("button", { name: /Buat reservasi/i }).click();
  await page.waitForURL("**/account?reserved=1");
  await page.getByRole("button", { name: /Simulasikan pembatalan/i }).first().click();
  await page.waitForURL("**/account?demoPayment=cancelled");
  await page.goto(`${base}/#tickets`);
  const after = Number((await page.locator(".picker-row").filter({ hasText: "Silver" }).first().innerText()).match(/(\d+) tersedia/)?.[1]);
  assert.equal(after, before);
  console.log(JSON.stringify({ result: "cancelled-payment-passed", before, after }));
} finally {
  await browser.close();
}
