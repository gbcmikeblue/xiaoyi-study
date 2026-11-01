/**
 * 验证数学题「读题目」是否命中预生成的 flac（而不是回退浏览器语音）。
 * 用法：node scripts/check-stem-audio.mjs
 */
import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = process.argv[2] || '5173';
const BASE = `http://127.0.0.1:${PORT}`;
const LESSON = process.argv[3] || '/#/v/sx-1a/l/sx-1a-u1-l01';

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
  window.__err = [];
  const orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.__played.push(this.src);
    const p = orig.apply(this, arguments);
    if (p && p.catch) p.catch((e) => window.__err.push(e.name));
    return p;
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

// 严格验证：直接解码同一地址，确认浏览器真的能播（而非仅请求了文件）
const decodable = await page.evaluate(async (src) => {
  if (!src) return { ok: false, reason: 'no src' };
  return new Promise((resolve) => {
    const a = new Audio(src);
    const done = (r) => resolve(r);
    a.addEventListener('loadedmetadata', () =>
      done({ ok: a.duration > 0, duration: Math.round(a.duration * 10) / 10 }),
    );
    a.addEventListener('error', () =>
      done({ ok: false, reason: 'decode-error', code: a.error && a.error.code }),
    );
    setTimeout(() => done({ ok: false, reason: 'timeout' }), 6000);
    a.load();
  });
}, played[0]);

const playErrors = await page.evaluate(() => window.__err || []);
const ok = played.length > 0 && played.every((f) => f.endsWith('.flac')) && decodable.ok;

console.log(
  JSON.stringify(
    {
      lesson: LESSON,
      stem: stemText,
      cueButtonFound: hasCue,
      played: played.map((u) => u.split('/').slice(-1)[0]),
      playErrors,
      decodable,
      flacRequests: audioRequests,
      hitPredbuiltAudio: ok,
    },
    null,
    2,
  ),
);
console.log(ok ? '\n通过：读题目命中预生成 flac' : '\n未命中：仍在回退浏览器语音');

await browser.close();
