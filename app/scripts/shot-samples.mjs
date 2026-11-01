/** 截取风格样张展示页（桌面 + 移动），用于确认布局。 */
import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:8080/style-samples.html';
const out = 'd:/project/sz-grade1-h5-edu-research/app/.shots';

const browser = await chromium.launch({ executablePath: CHROME });

for (const [name, w, h] of [
  ['samples-desktop', 1440, 900],
  ['samples-tablet', 820, 1180],
  ['samples-mobile', 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => ({
    cards: document.querySelectorAll('.card').length,
    cols: getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length,
    overflow: document.documentElement.scrollWidth > window.innerWidth,
  }));
  console.log(name, JSON.stringify(info));
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  await page.close();
}

await browser.close();
