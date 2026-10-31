import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:5173';
const LESSON = '/#/v/yw-1a/l/yw-1a-u1-l01';

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

const audioStatus = [];
page.on('response', (r) => {
  if (/\.(flac|wav|mp3)$/i.test(r.url())) audioStatus.push(r.status());
});

/** 气泡一直在漂移，跳过 Playwright 的元素稳定性检查 */
const bubble = (text) => page.locator('.bubble', { hasText: text }).first();

await page.goto(BASE + LESSON, { waitUntil: 'networkidle' });

check('课时标题渲染', (await page.locator('.lesson-title').innerText()) === '天地人');
check('目标清单 3 条', (await page.locator('.objectives li').count()) === 3);
check('汉字卡片 3 张', (await page.locator('.char-card').count()) === 3);

// 音频链路：点击汉字卡应请求 manifest 里的音频文件
await page.locator('.char-card').first().click();
await page.waitForTimeout(800);
// 206 是 Range 分段请求的正常响应
check(
  '点击汉字卡成功加载音频',
  audioStatus.length > 0 && audioStatus.every((s) => s === 200 || s === 206),
  audioStatus.join(','),
);

await page.getByRole('button', { name: '开始练习' }).click();
await page.waitForSelector('.bubble-stage.is-ready');
await page.waitForTimeout(300);
check('进入练习第 1 题', (await page.locator('.topbar-count').innerText()) === '1/3');
check('默认玩法为气泡', (await page.locator('.scene-switch').innerText()).includes('气泡'));
check('气泡数量与选项一致', (await page.locator('.bubble').count()) === 3);

// 场景切换
await page.locator('.scene-switch').click();
await page.waitForTimeout(250);
check('切换到卡片场景', (await page.locator('.option').count()) === 3);
await page.locator('.scene-switch').click();
await page.waitForTimeout(250);
check('切回气泡场景', (await page.locator('.bubble').count()) === 3);

// 第 1 题：听音选字，正确答案是“人”
await bubble('人').click({ force: true });
await page.waitForTimeout(150);
check('气泡出现选中态', (await page.locator('.bubble.is-picked').count()) === 1);

await page.getByRole('button', { name: '确认答案' }).click();
await page.waitForTimeout(250);
check('第 1 题判为正确', (await page.locator('.scene-veil .veil-title').innerText()) === '答对了');
check('正确气泡高亮', (await page.locator('.bubble.is-right').count()) === 1);
check('干扰气泡淡出', (await page.locator('.bubble.is-dim').count()) === 2);

// 草稿：刷新后应出现继续提示
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const hasResume = (await page.locator('.notice-resume').count()) === 1;
check('刷新后出现“继续上次”提示', hasResume);
if (hasResume) {
  await page.getByRole('button', { name: '继续' }).click();
  await page.waitForSelector('.bubble-stage.is-ready');
  await page.waitForTimeout(200);
  check('恢复后回到第 1 题', (await page.locator('.topbar-count').innerText()) === '1/3');
  check('恢复后保持已判定态', (await page.locator('.bubble.is-right').count()) === 1);
}

// 第 2 题
await page.getByRole('button', { name: '下一题' }).click();
await page.waitForTimeout(250);
await bubble('天').click({ force: true });
await page.getByRole('button', { name: '确认答案' }).click();
await page.waitForTimeout(250);
check('第 2 题判为正确', (await page.locator('.scene-veil .veil-title').innerText()) === '答对了');

// 第 3 题：多选
await page.getByRole('button', { name: '下一题' }).click();
await page.waitForTimeout(250);
for (const ch of ['天', '地', '人']) {
  await bubble(ch).click({ force: true });
}
await page.waitForTimeout(200);
check('多选题显示选择序号', (await page.locator('.bubble-mark').count()) === 3);
await page.getByRole('button', { name: '确认答案' }).click();
await page.waitForTimeout(250);
check('第 3 题判为正确', (await page.locator('.scene-veil .veil-title').innerText()) === '答对了');

await page.getByRole('button', { name: '看看成绩' }).click();
await page.waitForTimeout(400);
check('到达成绩页', (await page.locator('.result-title').innerText()).includes('全部答对'));
check('满分 3 星', (await page.locator('.star.filled').count()) === 3);

const saved = await page.evaluate(() => localStorage.getItem('g1.progress.v1'));
check('进度已写入 localStorage', Boolean(saved && saved.includes('yw-1a-u1-l01')));
const draft = await page.evaluate(() => localStorage.getItem('g1.draft.v1'));
check('完成后清除草稿', draft === null);

await page.getByRole('button', { name: '回到单元' }).click();
await page.waitForTimeout(500);
check('单元页显示已完成 1 个课时', /^1\/\d+$/.test(await page.locator('.topbar-count').innerText()));
check('课时行显示得分', (await page.locator('.lesson-badge.done').first().innerText()).includes('3/3'));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length === 0 ? 0 : 1);
