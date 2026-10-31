import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:5173';
const LESSON = '/#/v/yw-1a/l/yw-1a-u1-l01';

// 后两组扣掉 Safari 地址栏 + 标签栏的约 120px，模拟真实可视高度
const cases = [
  { name: 'ipad-landscape', w: 1024, h: 768 },
  { name: 'ipad-portrait', w: 768, h: 1024 },
  { name: 'ipad-safari-landscape', w: 1024, h: 648 },
  { name: 'ipad-safari-portrait', w: 768, h: 900 },
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const results = [];

for (const c of cases) {
  const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h } });
  const page = await ctx.newPage();
  await page.goto(BASE + LESSON, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '开始练习' }).click();
  await page.waitForSelector('.bubble-stage.is-ready');
  await page.waitForTimeout(250);

  // 先测未作答时
  const before = await page.evaluate(() => {
    const a = document.querySelector('.exercise-actions').getBoundingClientRect();
    const cue = document.querySelector('.speak-btn.prompt')?.getBoundingClientRect();
    return {
      innerH: window.innerHeight,
      actionsBottom: Math.round(a.bottom),
      actionsVisible: a.bottom <= window.innerHeight + 1,
      cueW: cue ? Math.round(cue.width) : 0,
      cueH: cue ? Math.round(cue.height) : 0,
    };
  });

  // 作答（第 1 题正确答案为「人」）后测一次，此时反馈已插入
  await page.locator('.bubble', { hasText: '人' }).first().click({ force: true });
  await page.getByRole('button', { name: '确认答案' }).click();
  await page.waitForTimeout(350);

  const after = await page.evaluate(() => {
    const btn = document.querySelector('.scene-veil .btn')?.getBoundingClientRect();
    const veil = document.querySelector('.scene-veil')?.getBoundingClientRect();
    const f = document.querySelector('.feedback')?.getBoundingClientRect();
    const vp = document.querySelector('.app-viewport');
    return {
      innerH: window.innerHeight,
      hasVeil: !!veil,
      btnW: btn ? Math.round(btn.width) : 0,
      btnH: btn ? Math.round(btn.height) : 0,
      btnTop: btn ? Math.round(btn.top) : -1,
      btnBottom: btn ? Math.round(btn.bottom) : -1,
      btnVisible: btn ? btn.top >= 0 && btn.bottom <= window.innerHeight + 1 : false,
      btnInsideScene: btn && veil ? btn.top >= veil.top - 1 && btn.bottom <= veil.bottom + 1 : false,
      feedbackVisible: f ? f.top >= 0 && f.bottom <= window.innerHeight + 1 : false,
      scrollY: Math.round(vp.scrollTop),
      scrollable: vp.scrollHeight > vp.clientHeight,
    };
  });

  await page.screenshot({ path: `.shots/${c.name}-practice.png` });
  results.push({ case: c.name, ...before, after });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
const bad = results.filter((r) => !r.after.btnVisible || !r.after.btnInsideScene);
console.log(
  bad.length === 0
    ? '\n全部视口：答对后按钮均落在选项区内部且无需滚动'
    : `\n仍有 ${bad.length} 个视口不达标：${bad.map((b) => b.case).join(', ')}`,
);
