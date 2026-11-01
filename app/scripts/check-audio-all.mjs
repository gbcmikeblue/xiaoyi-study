/**
 * 逐科目检查音频是否命中预生成 flac（而非回退浏览器语音）。
 * 用法：node scripts/check-audio-all.mjs [端口]
 */
import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = process.argv[2] || '8080';
const BASE = `http://127.0.0.1:${PORT}`;

const cases = [
  { name: '语文·识字（点汉字卡）', url: '/#/v/yw-1a/l/yw-1a-u1-l01', click: '.char-card', expect: '花小呗' },
  { name: '语文·拼音（点听音）', url: '/#/v/yw-1a/l/yw-1a-u2-l01', click: '.block-audio .speak-btn', expect: '花小呗' },
  { name: '语文·阅读（点听段落）', url: '/#/v/yw-1a/l/yw-1a-u5-l01', click: '.block-audio .speak-btn', expect: '花小呗' },
  { name: '英语·单词卡', url: '/#/v/yy-1a/l/yy-1a-u1-l01', click: '.word-card', expect: 'US_Stella' },
  { name: '数学·读题目', url: '/#/v/sx-1a/l/sx-1a-u1-l01', click: '.exercise-head .speak-btn', expect: '花小呗', practice: true },
];

const browser = await chromium.launch({ executablePath: CHROME });
const results = [];

for (const c of cases) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE + c.url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  if (c.practice) {
    const s = page.locator('button', { hasText: '开始练习' });
    if (await s.count()) {
      await s.first().click();
      await page.waitForTimeout(800);
    }
  }

  await page.evaluate(() => {
    window.__played = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.__played.push(this.src.split('/').slice(-1)[0]);
      return orig.apply(this, arguments);
    };
  });

  const target = page.locator(c.click).first();
  const found = (await page.locator(c.click).count()) > 0;
  if (found) {
    await target.click();
    await page.waitForTimeout(1300);
  }
  const played = await page.evaluate(() => window.__played);

  results.push({
    场景: c.name,
    预期音色: c.expect,
    找到按钮: found,
    播放文件: played,
    命中flac: played.length > 0 && played.every((f) => f.endsWith('.flac')),
  });
  await page.close();
}

// 答题反馈
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(BASE + '/#/v/yw-1a/l/yw-1a-u1-l01', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
const s = page.locator('button', { hasText: '开始练习' });
if (await s.count()) {
  await s.first().click();
  await page.waitForTimeout(800);
}
await page.evaluate(() => {
  window.__played = [];
  const orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.__played.push(this.src.split('/').slice(-1)[0]);
    return orig.apply(this, arguments);
  };
});
const bubbleCount = await page.locator('.bubble').count();
if (bubbleCount > 0) {
  // 气泡在持续漂移，Playwright 的可点击性检查会一直等「stable」，直接触发 click
  await page.evaluate(() => {
    const b = document.querySelector('.bubble');
    if (b) b.click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((x) =>
      x.textContent.includes('确认答案'),
    );
    if (btn) btn.click();
  });
  await page.waitForTimeout(1500);
}
const fbPlayed = await page.evaluate(() => window.__played);
results.push({
  场景: '答题反馈（判分音效）',
  预期音色: '花小呗',
  找到按钮: true,
  播放文件: fbPlayed,
  命中flac: fbPlayed.length > 0 && fbPlayed.every((f) => f.endsWith('.flac')),
});
await page.close();

console.log(JSON.stringify(results, null, 2));
const bad = results.filter((r) => !r.命中flac);
console.log(bad.length === 0 ? '\n全部场景命中预生成 flac' : `\n${bad.length} 处未命中：${bad.map((b) => b.场景).join(', ')}`);

await browser.close();
