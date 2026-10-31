import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:5173';
const OUT = path.resolve('.shots');
fs.mkdirSync(OUT, { recursive: true });

const cases = [
  { name: 'home-mobile', url: '/', w: 390, h: 844 },
  { name: 'units-mobile', url: '/#/v/yw-1a', w: 390, h: 844 },
  { name: 'lesson-mobile', url: '/#/v/yw-1a/l/yw-1a-u1-l01', w: 390, h: 844 },
  { name: 'practice-mobile', url: '/#/v/yw-1a/l/yw-1a-u1-l01', w: 390, h: 844, click: '开始练习' },
  { name: 'lesson-tablet', url: '/#/v/yw-1a/l/yw-1a-u1-l01', w: 1024, h: 768 },
  { name: 'units-tablet', url: '/#/v/yw-1a', w: 1024, h: 768 },
  { name: 'english-mobile', url: '/#/v/yy-1a/l/yy-1a-u1-l01', w: 390, h: 844 },
  { name: 'math-practice', url: '/#/v/sx-1a/l/sx-1a-u3-l01', w: 390, h: 844, click: '开始练习' },
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

for (const c of cases) {
  const ctx = await browser.newContext({
    viewport: { width: c.w, height: c.h },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(BASE + c.url, { waitUntil: 'networkidle' });
  if (c.click) {
    await page.getByRole('button', { name: c.click }).click();
    await page.waitForTimeout(500);
  }
  const metrics = await page.evaluate(() => {
    const pageEl = document.querySelector('.page');
    return {
      inner: window.innerWidth,
      scrollW: document.documentElement.scrollWidth,
      pageW: Math.round(pageEl?.getBoundingClientRect().width ?? 0),
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  console.log(c.name.padEnd(16), JSON.stringify(metrics));
  await page.screenshot({ path: path.join(OUT, c.name + '.png') });
  await ctx.close();
}

await browser.close();
