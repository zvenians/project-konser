import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import postgres from "postgres";

if (!process.env.DATABASE_URL?.includes("/sof_test?"))
  throw new Error("Use sof_test only");
const base = process.env.APP_URL ?? "http://localhost:3220";
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const [ticketClass] =
  await sql`SELECT id FROM ticket_classes WHERE mode='VENUE' AND name='Platinum'`;
const tag = randomUUID();
const [testTicket] =
  await sql`INSERT INTO ticket_inventory(class_id,file_key,file_hash,barcode,status,verified_at) VALUES (${ticketClass.id},${`test/${tag}.pdf`},${tag.replaceAll("-", "").padEnd(64, "0")},${`TEST-${tag}`},'AVAILABLE',now()) RETURNING id`;
await sql`UPDATE ticket_classes SET sale_enabled=true WHERE id=${ticketClass.id}`;
const browser = await chromium.launch({
  executablePath:
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
await fs.mkdir("artifacts/screenshots", { recursive: true });
const errors = [];
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      recordVideo: {
        dir: "artifacts/screenshots/videos",
        size: { width, height: 900 },
      },
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${width}: ${error.message}`));
    await page.goto(base);
    await page.getByRole("button", { name: "+ Platinum" }).click();
    await page.screenshot({
      path: `artifacts/screenshots/shotgun-selected-${width}.png`,
    });
    assert.match(await page.locator("body").innerText(), /Rp\s*2\.000\.000/);
    if (width === 390) {
      await page.getByRole("button", { name: "Buka menu" }).click();
      await page
        .locator("#event-mobile-nav .language-switch button")
        .filter({ hasText: "EN" })
        .click();
    } else {
      await page
        .locator(".event-nav-actions .language-switch button")
        .filter({ hasText: "EN" })
        .click();
    }
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    if (width === 390)
      assert.equal(await page.locator(".mobile-cart-bar").isVisible(), true);
    else assert.match(await page.locator("body").innerText(), /Order summary/);
    await page.goto(`${base}/checkout`);
    await page.getByRole("heading", { name: "Your tickets" }).waitFor();
    assert.match(await page.locator("body").innerText(), /Your tickets/);
    assert.match(await page.locator("body").innerText(), /Rp\s*2\.000\.000/);
    await page.screenshot({
      path: `artifacts/screenshots/shotgun-checkout-${width}.png`,
    });
    await page.getByRole("link", { name: /Sign in or register/ }).click();
    await page.waitForURL("**/login?next=checkout");
    await page.getByRole("heading", { name: "Create an account" }).waitFor();
    assert.match(page.url(), /next=checkout/);
    assert.match(await page.locator("body").innerText(), /Create an account/);
    await page.screenshot({
      path: `artifacts/screenshots/shotgun-login-${width}.png`,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    await page.close();
    await context.close();
    await fs.rename(
      await page.video().path(),
      `artifacts/screenshots/shotgun-${width}-interaction.webm`,
    );
  }
} finally {
  await browser.close();
  await sql`DELETE FROM ticket_inventory WHERE id=${testTicket.id} AND status='AVAILABLE'`;
  await sql.end();
}
assert.deepEqual(errors, []);
console.log(JSON.stringify({ result: "passed", widths: [390, 1440], errors }));
