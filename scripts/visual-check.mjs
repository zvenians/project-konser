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
  for (const width of [360, 390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${width}: ${error.message}`));
    await page.goto(base, { waitUntil: "networkidle" });
    const pageHeight = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    for (let y = 0; y < pageHeight; y += Math.round(900 * 0.7)) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(180);
    }
    await page.waitForTimeout(750);
    await page.screenshot({
      path: path.join(out, `home-${width}.png`),
      fullPage: true,
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    if (overflow) errors.push(`${width}: horizontal overflow`);
    await page.locator("#tiket").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, `tickets-${width}.png`) });
    const split = await page.locator("#tentang h2 [aria-hidden]").count();
    if (!split) errors.push(`${width}: SplitText words absent`);
    const visible = await page
      .locator("#tentang h2 [aria-hidden]")
      .first()
      .evaluate((el) => Number(getComputedStyle(el).opacity));
    if (visible < 0.95)
      errors.push(`${width}: SplitText reveal did not finish (${visible})`);
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`desktop: ${error.message}`));
  for (const route of ["/login", "/livestream"]) {
    await page.goto(base + route, { waitUntil: "networkidle" });
    await page.screenshot({
      path: path.join(out, `${route.slice(1)}-desktop.png`),
      fullPage: true,
    });
  }
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    await page.goto(base + "/login");
    await page
      .locator("form")
      .first()
      .locator('input[name="email"]')
      .fill(process.env.ADMIN_EMAIL);
    await page
      .locator("form")
      .first()
      .locator('input[name="password"]')
      .fill(process.env.ADMIN_PASSWORD);
    await Promise.all([
      page.waitForURL("**/account"),
      page.locator("form").first().locator('button[type="submit"]').click(),
    ]);
    await page.screenshot({
      path: path.join(out, "account-desktop.png"),
      fullPage: true,
    });
    await page.goto(base + "/admin", { waitUntil: "networkidle" });
    await page.screenshot({
      path: path.join(out, "admin-desktop.png"),
      fullPage: true,
    });
  }
  await context.close();
  const reduced = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    colorScheme: "dark",
  });
  const reducedPage = await reduced.newPage();
  reducedPage.on("pageerror", (error) =>
    errors.push(`reduced: ${error.message}`),
  );
  await reducedPage.goto(base, { waitUntil: "networkidle" });
  const reducedVisible = await reducedPage
    .locator("#tentang h2")
    .evaluate((el) => getComputedStyle(el).opacity);
  if (reducedVisible !== "1")
    errors.push(`reduced motion heading hidden: ${reducedVisible}`);
  const heroVisible = await reducedPage
    .locator(".hero-content > div")
    .evaluate((el) => getComputedStyle(el).opacity);
  if (heroVisible !== "1")
    errors.push(`reduced motion hero hidden: ${heroVisible}`);
  if (
    await reducedPage.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    )
  )
    errors.push("dark mobile overflow");
  await reducedPage.screenshot({
    path: path.join(out, "home-reduced-dark-390.png"),
  });
  await reduced.close();
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(base + "/login");
    await mobilePage
      .locator("form")
      .first()
      .locator('[name="email"]')
      .fill(process.env.ADMIN_EMAIL);
    await mobilePage
      .locator("form")
      .first()
      .locator('[name="password"]')
      .fill(process.env.ADMIN_PASSWORD);
    await mobilePage
      .locator("form")
      .first()
      .getByRole("button", { name: "Masuk" })
      .click();
    await mobilePage.waitForURL("**/account");
    await mobilePage.screenshot({
      path: path.join(out, "account-mobile.png"),
      fullPage: true,
    });
    await mobilePage.goto(base + "/admin", { waitUntil: "networkidle" });
    if (
      await mobilePage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      )
    )
      errors.push("admin mobile overflow");
    await mobilePage.screenshot({
      path: path.join(out, "admin-mobile.png"),
      fullPage: true,
    });
    await mobile.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({ screenshots: out, errors }, null, 2));
if (errors.length) process.exitCode = 1;
