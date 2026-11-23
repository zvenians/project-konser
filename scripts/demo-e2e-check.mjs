import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.APP_URL ?? "http://localhost:3230";
const browser = await chromium.launch({
  executablePath:
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto(base);
  await page.locator("[data-demo-preview]").waitFor();
  assert.match(await page.locator("body").innerText(), /170 tersedia/);
  await page.goto(`${base}/login`);
  await page.getByRole("button", { name: /Masuk sebagai Demo Customer/i }).waitFor();
  console.log(JSON.stringify({ result: "demo-shell-passed" }));
} finally {
  await browser.close();
}
