/** 验证：单元列表 → 课时详情 → 返回，列表恢复原滚动位置。 */
import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:8080';

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const top = () =>
  page.evaluate(() => Math.round(document.querySelector('.app-viewport').scrollTop));

// 1. 进单元列表
await page.goto(`${BASE}/#/v/yw-1a`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

// 2. 滚到第 8 单元附近
const maxScroll = await page.evaluate(() => {
  const vp = document.querySelector('.app-viewport');
  vp.scrollTop = 99999;
  return Math.round(vp.scrollTop);
});
await page.evaluate((y) => {
  document.querySelector('.app-viewport').scrollTop = y;
}, Math.round(maxScroll * 0.92));
await page.waitForTimeout(300);
const before = await top();

// 3. 点最后一个课时进详情
const clicked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.lesson-row')];
  const last = rows[rows.length - 1];
  if (!last) return null;
  const title = last.textContent?.trim().slice(0, 20);
  last.click();
  return title;
});
await page.waitForTimeout(900);
const inLesson = await page.evaluate(() => ({
  hash: location.hash,
  scrollTop: Math.round(document.querySelector('.app-viewport').scrollTop),
}));

// 4. 点返回按钮
await page.evaluate(() => {
  const btn = document.querySelector('.topbar .icon-btn');
  if (btn) btn.click();
});
await page.waitForTimeout(900);
const after = await top();
const hashBack = await page.evaluate(() => location.hash);

// 5. 再进一次另一个课时，确认新页面仍从头开始
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.lesson-row')];
  if (rows[0]) rows[0].click();
});
await page.waitForTimeout(800);
const secondEnter = await top();

console.log(
  JSON.stringify(
    {
      列表滚动最大值: maxScroll,
      离开列表时: before,
      点进课时: clicked,
      详情页: inLesson,
      返回后hash: hashBack,
      返回后滚动: after,
      第二名课时进入时滚动: secondEnter,
    },
    null,
    2,
  ),
);

const restored = Math.abs(after - before) <= 2;
const detailTop = inLesson.scrollTop === 0;
const freshEnter = secondEnter === 0;
console.log(
  restored && detailTop && freshEnter
    ? '\n通过：返回恢复原位置，新进入从顶部开始'
    : `\n异常：返回恢复=${restored} 详情页归零=${detailTop} 新进入归零=${freshEnter}`,
);

await browser.close();
