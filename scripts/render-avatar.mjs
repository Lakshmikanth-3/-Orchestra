import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await page.goto(`file://${path.join(__dirname, "avatar.html")}`);
await page.screenshot({ path: path.join(__dirname, "..", "docs", "asp-avatar.png") });
await browser.close();
console.log("done");
