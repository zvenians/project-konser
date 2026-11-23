import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.APP_URL ?? "http://localhost:3219";
const out = path.join(process.cwd(), "artifacts", "screenshots");
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const errors = [];
try {
  for (const width of [360, 390, 768, 1024, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 768 ? 1024 : 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${width}: ${error.message}`));
    await page.goto(base, { waitUntil: "networkidle" });
    await page.screenshot({
      path: path.join(out, `shotgun-home-${width}.png`),
      fullPage: true,
    });
    await page.locator("#tickets").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(out, `shotgun-tickets-${width}.png`),
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    if (overflow) errors.push(`${width}: horizontal overflow`);
    if (
      !(await page.getByRole("heading", { name: /Symphony of Faith/i }).count())
    )
      errors.push(`${width}: event title missing`);
    if (width === 390) {
      await page
        .getByRole("button", { name: /Detail tiket: Platinum/ })
        .click();
      await page.screenshot({
        path: path.join(out, "shotgun-ticket-detail-390.png"),
      });
      await page.getByRole("button", { name: "Tutup" }).click();
      await page.getByRole("button", { name: "Buka menu" }).click();
      if (!(await page.locator("#event-mobile-nav").isVisible()))
        errors.push("mobile menu did not open");
      await page.screenshot({ path: path.join(out, "shotgun-menu-390.png") });
      await page
        .locator("#event-mobile-nav .language-switch button")
        .filter({ hasText: "EN" })
        .click();
      await page.waitForLoadState("networkidle");
      if ((await page.locator("html").getAttribute("lang")) !== "en")
        errors.push("English html lang missing");
      if (
        !(await page.getByRole("heading", { name: "Choose tickets" }).count())
      )
        errors.push("English ticket heading missing");
      await page.screenshot({
        path: path.join(out, "shotgun-home-en-390.png"),
      });
    }
    await context.close();
  }
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    page.on("pageerror", (error) =>
      errors.push(`${width} secondary: ${error.message}`),
    );
    for (const route of ["/login", "/donate", "/livestream"]) {
      await page.goto(base + route, { waitUntil: "networkidle" });
      await page.screenshot({
        path: path.join(out, `shotgun-${route.slice(1)}-${width}.png`),
        fullPage: true,
      });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )
      )
        errors.push(`${width} ${route}: horizontal overflow`);
    }
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      await page.goto(base + "/login");
      await page
        .locator("form")
        .first()
        .locator('[name="email"]')
        .fill(process.env.ADMIN_EMAIL);
      await page
        .locator("form")
        .first()
        .locator('[name="password"]')
        .fill(process.env.ADMIN_PASSWORD);
      await page
        .locator("form")
        .first()
        .getByRole("button", { name: "Masuk" })
        .click();
      await page.waitForURL("**/account");
      await page.locator("#orders").waitFor();
      await page.screenshot({
        path: path.join(out, `shotgun-account-${width}.png`),
        fullPage: true,
      });
      await page.goto(base + "/admin", { waitUntil: "networkidle" });
      await page.screenshot({
        path: path.join(out, `shotgun-admin-${width}.png`),
        fullPage: true,
      });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )
      )
        errors.push(`${width} admin: horizontal overflow`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({ screenshots: out, errors }, null, 2));
if (errors.length) process.exitCode = 1;
