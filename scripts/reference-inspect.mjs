import { chromium } from "playwright";
import fs from "node:fs/promises";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const url = process.argv[2] ?? "https://shotgun.live/en";
await fs.mkdir("artifacts/reference", { recursive: true });
const results = [];
for (const [width, height] of [[1440,900],[1280,800],[1024,768],[768,1024],[390,844],[360,800]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `artifacts/reference/shotgun-${width}-initial.png` });
    await page.screenshot({ path: `artifacts/reference/shotgun-${width}-full.png`, fullPage: true });
    const data = await page.evaluate(() => ({
      title: document.title,
      text: document.body.innerText.slice(0, 13000),
      buttons: [...document.querySelectorAll("button")].map(el => ({ text: el.innerText, aria: el.getAttribute("aria-label") })).slice(0, 80),
      links: [...document.querySelectorAll("a")].map(el => ({ text: el.innerText, href: el.getAttribute("href") })).slice(0, 80),
      viewport: { innerWidth, scrollWidth: document.documentElement.scrollWidth },
    }));
    results.push({ width, status: response?.status(), url: page.url(), errors, ...data });
  } catch (error) {
    results.push({ width, error: String(error), url: page.url(), errors });
  }
  await page.close();
}
await fs.writeFile("artifacts/reference/inspection.json", JSON.stringify(results, null, 2));
console.log(results.map(({width,status,url,error,title,text}) => ({width,status,url,error,title,excerpt:text?.slice(0,1000)})));
await browser.close();
