import { chromium } from "playwright";
import { browserLaunchOptions } from "./browser-launch.mjs";
import fs from "node:fs/promises";

const browser = await chromium.launch(browserLaunchOptions());
const results = [];
for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: "artifacts/reference/videos", size: { width, height } },
  });
  const page = await context.newPage();
  await page.goto("https://shotgun.live/en/events/a4systemxpedro-booking", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);
  const deny = page.getByRole("button", { name: "DENY", exact: true });
  if (await deny.count()) {
    await deny.first().click();
    await page.waitForTimeout(700);
  }
  await page
    .getByRole("heading", { name: "Tickets", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/reference/shotgun-${width}-tickets.png`,
  });
  const plus = page.getByRole("button", { name: "Add", exact: true });
  results.push({
    width,
    plus: await plus.count(),
    before: (await page.locator("body").innerText()).slice(0, 1800),
  });
  if (await plus.count()) {
    await plus.first().click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `artifacts/reference/shotgun-${width}-selected.png`,
    });
    results.at(-1).after = (await page.locator("body").innerText()).slice(
      0,
      2200,
    );
  }
  await page.close();
  await context.close();
  await fs.rename(
    await page.video().path(),
    `artifacts/reference/shotgun-${width}-interaction.webm`,
  );
}
await fs.writeFile(
  "artifacts/reference/shotgun-interactions.json",
  JSON.stringify(results, null, 2),
);
console.log(
  results.map(({ width, plus, before, after }) => ({
    width,
    plus,
    before: before.slice(0, 700),
    after: after?.slice(0, 1000),
  })),
);
await browser.close();
