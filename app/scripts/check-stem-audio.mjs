/**
 * 验证数学题「读题目」是否命中预生成的 flac（而不是回退浏览器语音）。
 * 用法：node scripts/check-stem-audio.mjs
 */
import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:5173';
const LESSON = '/#/v/sx-1a/l/sx-1a-u1-l01';

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const audioRequests = [];
page.on('response', (r) => {
  if (/\.flac$/i.test(r.url())) audioRequests.push(r.status());
});

await page.goto(BASE + LESSON, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);

// 进入练习
const start = page.locator('button', { hasText: '开始练习' });
if (await start.count()) {
  await start.first().click();
  await page.waitForTimeout(900);
}

// 挂接播放钩子
await page.evaluate(() => {
  window.__played = [];
  const orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.__played.push(this.src.split('/').slice(-1)[0]);
    return orig.apply(this, arguments);
  };
});

const cue = page.locator('.exercise-head .speak-btn');
const hasCue = (await cue.count()) > 0;
let played = [];
let stemText = '';

if (hasCue) {
  await cue.first().click();
  await page.waitForTimeout(1500);
  played = await page.evaluate(() => window.__played);
  stemText = (await page.locator('.exercise-stem').innerText()).trim().slice(0, 24);
}

const ok = played.length > 0 && played.every((f) => f.endsWith('.flac'));

console.log(
  JSON.stringify(
    {
      lesson: LESSON,
      stem: stemText,
      cueButtonFound: hasCue,
      played,
      flacRequests: audioRequests,
      hitPredbuiltAudio: ok,
    },
    null,
    2,
  ),
);
console.log(ok ? '\n通过：读题目命中预生成 flac' : '\n未命中：仍在回退浏览器语音');

await browser.close();
