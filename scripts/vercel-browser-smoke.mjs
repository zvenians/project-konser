import { chromium } from "playwright";
import { browserContextOptions, browserLaunchOptions } from "./browser-launch.mjs";

const browser = await chromium.launch(browserLaunchOptions());
const page = await browser.newPage(browserContextOptions());
const response = await page.goto(process.env.APP_URL);
console.log(JSON.stringify({ status: response?.status(), title: await page.title(), url: page.url(), demo: await page.locator("[data-demo-preview]").count() }));
await browser.close();
