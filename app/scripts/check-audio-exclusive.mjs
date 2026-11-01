/** 验证同一时刻只播放一个声音。 */
import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:5173';

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(`${BASE}/#/v/yw-1a/l/yw-1a-u1-l01`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

// 记录所有 Audio 实例
await page.evaluate(() => {
  window.__audios = [];
  const Orig = window.Audio;
  window.Audio = function (src) {
    const a = new Orig(src);
    a.__src = src;
    window.__audios.push(a);
    return a;
  };
});

const n = await page.locator('.char-card').count();

// 点第一张，150ms 后点第二张（故意打断）
await page.evaluate(() => document.querySelectorAll('.char-card')[0].click());
await page.waitForTimeout(150);
await page.evaluate(() => document.querySelectorAll('.char-card')[1].click());

// 等到跨过 900ms 的「词语」延迟
await page.waitForTimeout(1400);

const result = await page.evaluate(() => {
  const audios = window.__audios || [];
  return {
    total: audios.length,
    playing: audios.filter((a) => !a.paused && !a.ended).length,
    details: audios.map((a) => ({
      src: (a.__src || '').split('/').pop(),
      paused: a.paused,
      ended: a.ended,
      t: Math.round(a.currentTime * 10) / 10,
    })),
  };
});

console.log(`字符卡数量: ${n}`);
console.log(JSON.stringify(result, null, 2));

// 期望：两次点击各一个单字 + 最后一张卡片的词语 = 3 个实例；
// 第一个卡片的词语「天空」不应出现（说明打断时延迟任务被取消）
const ok = result.playing <= 1 && result.total <= 3;
console.log(ok ? '\n通过：同一时刻最多一个声音，被中断卡片的延迟词语未播放' : '\n异常：多声并行或有迟到的延迟播放');

await browser.close();
