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
  await page.getByRole("button", { name: /Masuk sebagai Demo Customer/i }).click();
  await page.waitForURL("**/account");

  await page.goto(`${base}/#tickets`);
  const gold = page.locator(".picker-row").filter({ hasText: "Gold" }).first();
  const beforeText = await gold.innerText();
  const before = Number(beforeText.match(/(\d+) tersedia/)?.[1]);
  await gold.getByRole("button", { name: "+ Gold" }).click();
  await gold.getByRole("button", { name: "+ Gold" }).click();
  await page.getByRole("link", { name: /Lanjut ke checkout/i }).click();
  await page.getByRole("heading", { name: /Tiket pilihan Anda/i }).waitFor();
  assert.match(await page.locator("body").innerText(), /2 × Gold/);
  await page.getByRole("button", { name: /Buat reservasi/i }).click();
  await page.waitForURL("**/account?reserved=1");
  await page.getByRole("button", { name: /Bayar berhasil/i }).first().click();
  await page.waitForURL("**/account?demoPayment=success");
  await page.getByText("SIMULATED", { exact: false }).first().waitFor();
  const ticketLinks = page.getByRole("link", { name: /Unduh tiket demo/i });
  assert.equal(await ticketLinks.count(), 2);
  const firstCode = await page.locator("[data-demo-ticket-code]").first().innerText();

  for (let index = 0; index < 2; index++) {
    const downloadPromise = page.waitForEvent("download");
    await ticketLinks.nth(index).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.equal(Buffer.concat(chunks).subarray(0, 4).toString(), "%PDF");
  }

  await page.goto(`${base}/#tickets`);
  const afterText = await page.locator(".picker-row").filter({ hasText: "Gold" }).first().innerText();
  const after = Number(afterText.match(/(\d+) tersedia/)?.[1]);
  assert.equal(after, before - 2);

  await page.goto(`${base}/account`);
  await page.getByRole("button", { name: "Keluar" }).click();
  await page.goto(`${base}/login`);
  await page.getByRole("button", { name: /Masuk sebagai Demo Administrator/i }).click();
  await page.waitForURL("**/admin");
  const checkin = page.locator("[data-demo-checkin]");
  await checkin.locator('input[name="barcode"]').fill(firstCode);
  await checkin.getByRole("button", { name: /Validasi check-in/i }).click();
  await checkin.getByText(/Check-in berhasil/i).waitFor();
  await checkin.getByRole("button", { name: /Validasi check-in/i }).click();
  await checkin.getByText(/sudah digunakan/i).waitFor();

  await page.goto(`${base}/account`);
  await page.goto(`${base}/login`);
  await page.getByRole("button", { name: /Masuk sebagai Demo Customer/i }).click();
  await page.waitForURL("**/account");
  await page.goto(`${base}/#tickets`);
  await page.getByRole("tab", { name: "Livestream" }).click();
  const liveGold = page.locator(".picker-row").filter({ hasText: "Gold" }).first();
  await liveGold.getByRole("button", { name: "+ Gold" }).click();
  await page.getByRole("link", { name: /Lanjut ke checkout/i }).click();
  await page.getByRole("button", { name: /Buat reservasi/i }).click();
  await page.waitForURL("**/account?reserved=1");
  await page.getByRole("button", { name: /Bayar berhasil/i }).first().click();
  await page.waitForURL("**/account?demoPayment=success");
  await page.goto(`${base}/livestream`);
  await page.locator("video[data-demo-stream]").waitFor();
  assert.equal(await page.locator("[data-stream-state]").innerText(), "LIVE");
  console.log(JSON.stringify({ result: "venue-checkin-and-livestream-passed", before, after }));
} finally {
  await browser.close();
}
