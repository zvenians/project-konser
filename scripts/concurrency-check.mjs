import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { browserLaunchOptions } from "./browser-launch.mjs";
import postgres from "postgres";

if (!process.env.DATABASE_URL?.includes("/sof_test?"))
  throw new Error("Test concurrency hanya boleh memakai sof_test");
const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false });
const browser = await chromium.launch(browserLaunchOptions());
const base = process.env.APP_URL ?? "http://localhost:3220";
const tag = randomUUID().slice(0, 8);
try {
  const [ticketClass] =
    await sql`SELECT id FROM ticket_classes WHERE mode='VENUE' AND name='Platinum'`;
  const [ticket] =
    await sql`INSERT INTO ticket_inventory(class_id,file_key,file_hash,barcode,status,verified_at) VALUES (${ticketClass.id},${`test/${tag}.pdf`},${randomUUID().replaceAll("-", "").padEnd(64, "0")},${`TEST-${tag}`},'AVAILABLE',now()) RETURNING id`;
  await sql`UPDATE ticket_classes SET sale_enabled=true WHERE id=${ticketClass.id}`;
  const pages = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${base}/login`);
    const register = page.locator("form").nth(1);
    await register.locator('[name="name"]').fill(`Concurrent ${i}`);
    await register
      .locator('[name="email"]')
      .fill(`concurrent-${tag}-${i}@example.test`);
    await register
      .locator('[name="password"]')
      .fill(`ConcurrentPassword-${tag}-${i}`);
    await register.getByRole("button", { name: "Buat akun" }).click();
    await page.waitForURL("**/account");
    await page.goto(base);
    await page.getByRole("button", { name: "+ Platinum" }).click();
    await page
      .getByRole("link", { name: /Lanjut ke checkout/ })
      .first()
      .click();
    await page.waitForURL("**/checkout");
    pages.push({ context, page });
  }
  await Promise.all(
    pages.map(({ page }) =>
      page
        .getByRole("button", { name: "Buat reservasi" })
        .click()
        .catch(() => {}),
    ),
  );
  await Promise.all(
    pages.map(({ page }) =>
      page.waitForLoadState("networkidle").catch(() => {}),
    ),
  );
  const [result] =
    await sql`SELECT t.status,count(a.ticket_id)::integer AS allocations FROM ticket_inventory t LEFT JOIN ticket_allocations a ON a.ticket_id=t.id WHERE t.id=${ticket.id} GROUP BY t.id`;
  assert.equal(result.status, "RESERVED");
  assert.equal(result.allocations, 1);
  const [orders] =
    await sql`SELECT count(*)::integer AS total FROM orders o JOIN users u ON u.id=o.user_id WHERE u.email LIKE ${`concurrent-${tag}-%`}`;
  assert.equal(orders.total, 1);
  console.log(
    JSON.stringify({
      result: "passed",
      ticket: ticket.id,
      allocations: result.allocations,
      orders: orders.total,
    }),
  );
  for (const { context } of pages) await context.close();
} finally {
  await browser.close();
  await sql.end();
}
