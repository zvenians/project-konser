import assert from "node:assert/strict";
import { chromium } from "playwright";
import { browserLaunchOptions } from "./browser-launch.mjs";

const base = process.env.APP_URL ?? "http://localhost:3230";
const demoAdminCode = process.env.DEMO_ADMIN_CODE;
assert.ok(demoAdminCode, "DEMO_ADMIN_CODE is required for admin E2E");
const browser = await chromium.launch(browserLaunchOptions());

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
  const adminLogin = page.locator("form").filter({ hasText: "Demo Administrator" });
  await adminLogin.locator('input[name="accessCode"]').fill(demoAdminCode);
  await adminLogin.getByRole("button", { name: /Masuk sebagai Demo Administrator/i }).click();
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

  await page.goto(`${base}/donate`);
  await page.locator('input[name="name"]').fill("Client Demo");
  await page.locator('input[name="amount"]').fill("100000");
  await page.locator('input[name="anonymous"]').check();
  await page.getByRole("button", { name: /Simulasikan donasi/i }).click();
  await page.waitForURL("**/donations/*?demo=1");
  await page.getByText("Rp100.000", { exact: false }).waitFor();
  assert.match(await page.locator("body").innerText(), /Rp100.000/);
  assert.match(await page.locator("body").innerText(), /SIMULATED/);

  await page.goto(`${base}/#tickets`);
  const bronze = page.locator(".picker-row").filter({ hasText: "Bronze" }).first();
  const bronzeBefore = Number((await bronze.innerText()).match(/(\d+) tersedia/)?.[1]);
  await bronze.getByRole("button", { name: "+ Bronze" }).click();
  await page.locator(".event-nav-actions .language-switch").getByRole("button", { name: "EN" }).click();
  await page.waitForLoadState("networkidle");
  assert.match(await page.locator("body").innerText(), /1 × Bronze/);
  await page.getByRole("link", { name: /Continue to checkout/i }).click();
  await page.locator(".event-nav-actions .language-switch").getByRole("button", { name: "ID" }).click();
  await page.waitForLoadState("networkidle");
  assert.match(await page.locator("body").innerText(), /1 × Bronze/);
  await page.getByRole("button", { name: /Buat reservasi/i }).click();
  await page.waitForURL("**/account?reserved=1");
  await page.getByRole("button", { name: /pembayaran gagal/i }).first().click();
  await page.waitForURL("**/account?demoPayment=failed");
  assert.equal(await page.getByRole("link", { name: /Unduh tiket demo/i }).count(), 2);
  await page.goto(`${base}/#tickets`);
  const bronzeAfter = Number((await page.locator(".picker-row").filter({ hasText: "Bronze" }).first().innerText()).match(/(\d+) tersedia/)?.[1]);
  assert.equal(bronzeAfter, bronzeBefore);

  await page.goto(`${base}/login`);
  const finalAdminLogin = page.locator("form").filter({ hasText: "Demo Administrator" });
  await finalAdminLogin.locator('input[name="accessCode"]').fill(demoAdminCode);
  await finalAdminLogin.getByRole("button", { name: /Masuk sebagai Demo Administrator/i }).click();
  await page.waitForURL("**/admin");
  assert.match(await page.locator("#donations").innerText(), /100.000/);
  assert.match(await page.locator("#notifications").innerText(), /SIMULATED_DELIVERED/);
  await page.getByRole("button", { name: /Reset data demo/i }).click();
  await page.getByRole("button", { name: /Konfirmasi reset/i }).click();
  await page.waitForURL("**/admin?demoReset=1");
  await page.goto(`${base}/#tickets`);
  assert.match(await page.locator(".picker-row").filter({ hasText: "Gold" }).first().innerText(), /170 tersedia/);
  console.log(JSON.stringify({
    result: "all-demo-scenarios-passed",
    venueStock: { before, after },
    failedPaymentReleased: bronzeAfter === bronzeBefore,
  }));
} finally {
  await browser.close();
}
