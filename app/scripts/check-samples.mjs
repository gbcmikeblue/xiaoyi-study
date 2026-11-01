/** 验证样张页的筛选与灯箱交互。 */
import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:8080/style-samples.html';

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(URL, { waitUntil: 'networkidle' });

const total = await page.locator('.card').count();
const visible = async () => page.locator('.card:not([hidden])').count();

const results = { total, all: await visible() };

for (const f of ['block', 'render', 'line', 'warm', 'neutral']) {
  await page.locator(`.chip[data-filter="${f}"]`).click();
  await page.waitForTimeout(150);
  results[f] = await visible();
}

await page.locator('.chip[data-filter="all"]').click();
await page.waitForTimeout(150);
results.backToAll = await visible();

// 灯箱
await page.locator('.thumb').first().click();
await page.waitForTimeout(300);
results.lightboxOpen = await page.locator('.lightbox.open').count();
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
results.lightboxClosed = (await page.locator('.lightbox.open').count()) === 0;

console.log(JSON.stringify(results, null, 2));

const ok =
  results.all === 10 &&
  results.block === 3 &&
  results.render === 3 &&
  results.line === 4 &&
  results.warm === 6 &&
  results.neutral === 2 &&
  results.backToAll === 10 &&
  results.lightboxOpen === 1 &&
  results.lightboxClosed;
console.log(ok ? '\n通过：筛选与灯箱均正常' : '\n异常：数量与预期不符');

await browser.close();
