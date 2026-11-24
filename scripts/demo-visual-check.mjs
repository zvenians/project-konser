import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import { browserLaunchOptions } from "./browser-launch.mjs";

const base = process.env.APP_URL ?? "http://localhost:3230";
const accessCode = process.env.DEMO_ADMIN_CODE;
assert.ok(accessCode, "DEMO_ADMIN_CODE is required");
await fs.mkdir("artifacts/screenshots", { recursive: true });
const browser = await chromium.launch(browserLaunchOptions());
const errors = [];
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on("pageerror", (error) => errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/login`);
    const form = page.locator("form").filter({ hasText: "Demo Administrator" });
    await form.locator('input[name="accessCode"]').fill(accessCode);
    await form.getByRole("button", { name: /Masuk sebagai Demo Administrator/i }).click();
    await page.waitForURL("**/admin");
    await page.locator("#overview").waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: `artifacts/screenshots/demo-admin-${width}.png`, fullPage: true });
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: "demo-admin-visual-passed", widths: [390, 1440] }));
} finally {
  await browser.close();
}
