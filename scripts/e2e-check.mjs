import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import postgres from "postgres";

if (!process.env.DATABASE_URL?.includes("/sof_test?"))
  throw new Error("E2E hanya boleh memakai sof_test");
const base = process.env.APP_URL ?? "http://localhost:3220";
const sql = postgres(process.env.DATABASE_URL, { max: 3, prepare: false });
const browser = await chromium.launch({
  executablePath:
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
async function waitForStatus(table, id, expected) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const [record] = await sql.unsafe(
      `SELECT status FROM ${table} WHERE id=$1`,
      [id],
    );
    if (record?.status === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const [record] = await sql.unsafe(`SELECT status FROM ${table} WHERE id=$1`, [
    id,
  ]);
  assert.equal(record?.status, expected);
}
async function waitForOrder(email, total) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const [order] =
      await sql`SELECT o.id,o.status FROM orders o JOIN users u ON u.id=o.user_id WHERE u.email=${email} AND o.total=${total} ORDER BY o.created_at DESC LIMIT 1`;
    if (order) return order;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Order ${total} not created`);
}
const id = randomUUID().slice(0, 8);
const screenshots = path.join(process.cwd(), "artifacts", "screenshots");
await fs.mkdir(screenshots, { recursive: true });
const adminContext = await browser.newContext();
const customerContext = await browser.newContext();
const admin = await adminContext.newPage();
const customer = await customerContext.newPage();
try {
  await admin.goto(`${base}/login`);
  await admin
    .locator("form")
    .first()
    .locator('[name="email"]')
    .fill(process.env.ADMIN_EMAIL);
  await admin
    .locator("form")
    .first()
    .locator('[name="password"]')
    .fill(process.env.ADMIN_PASSWORD);
  await admin
    .locator("form")
    .first()
    .getByRole("button", { name: "Masuk" })
    .click();
  await admin.waitForURL("**/account");
  await admin.goto(`${base}/admin`);
  assert.match(await admin.locator("h1").innerText(), /Pusat pengelolaan/);
  await admin.screenshot({
    path: path.join(screenshots, "inventory-desktop.png"),
    fullPage: true,
  });
  const [platinum] =
    await sql`SELECT id FROM ticket_classes WHERE mode='VENUE' AND name='Platinum'`;
  const badPdf = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(100)]);
  const invalidImport = await adminContext.request.post(
    `${base}/api/admin/tickets/batch`,
    {
      multipart: {
        classId: platinum.id,
        manifest: {
          name: "manifest.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(
            `filename,barcode,sha256\nwrong.pdf,WRONG-${id},${"0".repeat(64)}\n`,
          ),
        },
        files: {
          name: "wrong.pdf",
          mimeType: "application/pdf",
          buffer: badPdf,
        },
      },
    },
  );
  assert.equal(invalidImport.status(), 400);
  assert.match((await invalidImport.json()).error, /Hash PDF/);
  await admin.locator('form[action="/admin"]').count();
  await admin
    .locator("form")
    .filter({ has: admin.locator('[name="bank"]') })
    .locator('[name="bank"]')
    .fill("BANK TEST");
  await admin.locator('[name="account"]').fill("0000000000");
  await admin.locator('[name="holder"]').fill("TEST ONLY");
  await admin
    .getByRole("button", { name: "Simpan instruksi transfer" })
    .click();
  await admin.waitForURL("**/admin");
  await admin.locator('[name="videoId"]').fill("abcdefghijk");
  await admin.getByRole("button", { name: "Simpan status siaran" }).click();
  await admin.waitForURL("**/admin");
  const streamRow = admin.getByRole("row", { name: /LIVESTREAM · Reguler/ });
  if (await streamRow.getByRole("button", { name: "Buka" }).count()) {
    await streamRow.getByRole("button", { name: "Buka" }).click();
    await admin.waitForURL("**/admin#inventory");
  }
  const email = `test-${id}@example.test`;
  await customer.goto(`${base}/login`);
  const register = customer.locator("form").nth(1);
  await register.locator('[name="name"]').fill("Test Customer");
  await register.locator('[name="email"]').fill(email);
  await register.locator('[name="password"]').fill(`TestPassword-${id}-Long`);
  await register.getByRole("button", { name: "Buat akun" }).click();
  await customer.waitForURL("**/account");
  const unauthorizedReport = await customerContext.request.get(
    `${base}/api/admin/reports?kind=orders`,
  );
  assert.equal(unauthorizedReport.status(), 403);
  const unauthorizedImport = await customerContext.request.post(
    `${base}/api/admin/tickets/batch`,
    { multipart: {} },
  );
  assert.equal(unauthorizedImport.status(), 403);
  await customer.goto(base);
  await customer.getByRole("tab", { name: "Livestream" }).click();
  await customer.getByRole("button", { name: "+ Reguler" }).click();
  await customer
    .getByRole("link", { name: /Lanjut ke checkout/ })
    .first()
    .click();
  await customer.waitForURL("**/checkout");
  await customer.getByRole("button", { name: "Buat reservasi" }).click();
  await customer.waitForURL("**/account?reserved=1");
  assert.match(await customer.locator("#orders").innerText(), /Menunggu/);
  await customer.screenshot({
    path: path.join(screenshots, "checkout-desktop.png"),
    fullPage: true,
  });
  const [order] =
    await sql`SELECT o.id,o.total,o.status FROM orders o JOIN users u ON u.id=o.user_id WHERE u.email=${email}`;
  assert.equal(Number(order.total), 50000);
  assert.equal(order.status, "PENDING");
  await customer.goto(`${base}/livestream`);
  assert.match(await customer.locator("main").innerText(), /Akses belum aktif/);
  await customer.goto(`${base}/account`);
  await customer.locator('input[name="reference"]').fill(`TRANSFER-${id}`);
  await customer.getByRole("button", { name: "Ajukan verifikasi" }).click();
  await customer.waitForLoadState("networkidle");
  await customer.reload({ waitUntil: "networkidle" });
  assert.equal(
    (await sql`SELECT status FROM orders WHERE id=${order.id}`)[0].status,
    "PAYMENT_REVIEW",
  );
  await admin.goto(`${base}/admin`);
  const verify = admin
    .locator("form")
    .filter({ has: admin.locator(`[name="orderId"][value="${order.id}"]`) });
  await verify.locator('[name="bankReference"]').fill(`BANK-${id}`);
  await verify.locator('[name="receivedAmount"]').fill("50000");
  await verify.locator('[name="bankConfirmed"]').check();
  await verify.getByRole("button", { name: "Verifikasi transfer" }).click();
  await admin.waitForLoadState("networkidle");
  await waitForStatus("orders", order.id, "CONFIRMED");
  assert.equal(
    (
      await sql`SELECT active FROM stream_entitlements WHERE order_id=${order.id}`
    )[0].active,
    true,
  );
  await customer.goto(`${base}/livestream`);
  assert.match(
    await customer.locator("main").innerText(),
    /Siaran belum dimulai/,
  );
  await customer.screenshot({
    path: path.join(screenshots, "livestream-entitled-desktop.png"),
    fullPage: true,
  });
  await customer.goto(`${base}/donate`);
  await customer.locator('[name="name"]').fill("Test Donor");
  await customer.locator('[name="amount"]').fill("10000");
  await customer.locator('[name="reference"]').fill(`DONATE-${id}`);
  await customer
    .getByRole("button", { name: "Ajukan verifikasi donasi" })
    .click();
  await customer.waitForURL("**/donations/*");
  const [donation] =
    await sql`SELECT id,status FROM donations WHERE payment_reference=${`DONATE-${id}`}`;
  assert.equal(donation.status, "PENDING");
  await admin.goto(`${base}/admin`);
  const donationVerify = admin.locator("form").filter({
    has: admin.locator(`[name="donationId"][value="${donation.id}"]`),
  });
  await donationVerify
    .locator('[name="bankReference"]')
    .fill(`DONATION-BANK-${id}`);
  await donationVerify.locator('[name="receivedAmount"]').fill("10000");
  await donationVerify.locator('[name="bankConfirmed"]').check();
  await donationVerify
    .getByRole("button", { name: "Verifikasi donasi" })
    .click();
  await admin.waitForLoadState("networkidle");
  await waitForStatus("donations", donation.id, "VERIFIED");
  const [adminUser] =
    await sql`SELECT id FROM users WHERE email=${process.env.ADMIN_EMAIL}`;
  await assert.rejects(
    sql`INSERT INTO bank_receipts(bank_reference,amount,source_type,source_id,recorded_by) VALUES (${`BANK-${id}`},10000,'DONATION',${randomUUID()},${adminUser.id})`,
  );
  const [venueClass] =
    await sql`SELECT id FROM ticket_classes WHERE mode='VENUE' AND name='Platinum'`;
  const venueBarcode = `VENUE-${id}`;
  const [venueTicket] =
    await sql`INSERT INTO ticket_inventory(class_id,file_key,file_hash,barcode,status,verified_at) VALUES (${venueClass.id},${`test/${id}.pdf`},${randomUUID().replaceAll("-", "").padEnd(64, "0")},${venueBarcode},'AVAILABLE',now()) RETURNING id`;
  await sql`UPDATE ticket_classes SET sale_enabled=true WHERE id=${venueClass.id}`;
  await customer.goto(base);
  await customer.getByRole("button", { name: "+ Platinum" }).click();
  await customer
    .getByRole("link", { name: /Lanjut ke checkout/ })
    .first()
    .click();
  await customer.waitForURL("**/checkout");
  await customer.getByRole("button", { name: "Buat reservasi" }).click();
  await customer.waitForURL("**/account?reserved=1");
  const venueOrder = await waitForOrder(email, 2000000);
  assert.equal(venueOrder.status, "PENDING");
  await customer.goto(`${base}/account`);
  const venueClaim = customer.locator("article.record").filter({
    has: customer.locator(`[name="orderId"][value="${venueOrder.id}"]`),
  });
  await venueClaim.locator('[name="reference"]').fill(`VENUE-TRANSFER-${id}`);
  await venueClaim.getByRole("button", { name: "Ajukan verifikasi" }).click();
  await customer.waitForLoadState("networkidle");
  await admin.goto(`${base}/admin`);
  const venueVerify = admin.locator("form").filter({
    has: admin.locator(`[name="orderId"][value="${venueOrder.id}"]`),
  });
  await venueVerify.locator('[name="bankReference"]').fill(`VENUE-BANK-${id}`);
  await venueVerify.locator('[name="receivedAmount"]').fill("2000000");
  await venueVerify.locator('[name="bankConfirmed"]').check();
  await venueVerify
    .getByRole("button", { name: "Verifikasi transfer" })
    .click();
  await admin.waitForLoadState("networkidle");
  await waitForStatus("orders", venueOrder.id, "CONFIRMED");
  assert.equal(
    (
      await sql`SELECT status FROM ticket_inventory WHERE id=${venueTicket.id}`
    )[0].status,
    "SOLD",
  );
  await admin.goto(`${base}/admin#checkin`);
  await admin.locator('#checkin [name="barcode"]').fill(venueBarcode);
  await admin.getByRole("button", { name: "Validasi & catat masuk" }).click();
  await admin.waitForLoadState("networkidle");
  for (let attempt = 0; attempt < 20; attempt++) {
    const [count] =
      await sql`SELECT count(*)::integer AS total FROM ticket_checkins WHERE ticket_id=${venueTicket.id}`;
    if (count.total === 1) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(
    (
      await sql`SELECT count(*)::integer AS total FROM ticket_checkins WHERE ticket_id=${venueTicket.id}`
    )[0].total,
    1,
  );
  await admin.goto(`${base}/admin#checkin`);
  await admin.locator('#checkin [name="barcode"]').fill(venueBarcode);
  await admin.getByRole("button", { name: "Validasi & catat masuk" }).click();
  await admin.waitForLoadState("networkidle");
  assert.equal(
    (
      await sql`SELECT count(*)::integer AS total FROM ticket_checkins WHERE ticket_id=${venueTicket.id}`
    )[0].total,
    1,
  );
  const [expired] =
    await sql`INSERT INTO orders(user_id,idempotency_key,total,expires_at) SELECT id,${randomUUID()},50000,now()-interval '1 minute' FROM users WHERE email=${email} RETURNING id`;
  const cron = await customerContext.request.get(`${base}/api/cron/expire`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  assert.equal(cron.status(), 200);
  assert.equal(
    (await sql`SELECT status FROM orders WHERE id=${expired.id}`)[0].status,
    "EXPIRED",
  );
  const forbidden = await customerContext.request.get(
    `${base}/api/tickets/${randomUUID()}`,
  );
  assert.notEqual(forbidden.status(), 200);
  console.log(
    JSON.stringify({
      result: "passed",
      order: order.id,
      donation: donation.id,
      cases: [
        "auth",
        "admin setup",
        "reservation",
        "payment review",
        "manual bank verification",
        "livestream entitlement",
        "donation verification",
        "duplicate bank receipt rejection",
        "venue reservation and check-in",
        "expiration",
        "private PDF access",
      ],
    }),
  );
} finally {
  await browser.close();
  await sql.end();
}
