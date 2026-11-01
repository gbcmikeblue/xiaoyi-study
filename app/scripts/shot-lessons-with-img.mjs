/** 截取带插图的课时页，确认渲染效果。 */
import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'd:/project/sz-grade1-h5-edu-research/app/.shots';

const cases = [
  ['img-food', '/#/v/yy-1b/l/yy-1b-u1-l01'],
  ['img-egg', '/#/v/sx-1a/l/sx-1a-u1-l05'],
  ['img-season', '/#/v/yy-1b/l/yy-1b-u4-l01'],
  ['img-jingye', '/#/v/yw-1b/l/yw-1b-u4-l01'],
  ['img-zongzi', '/#/v/yw-1b/l/yw-1b-u4-l03'],
];

const browser = await chromium.launch({ executablePath: CHROME });

for (const [name, path] of cases) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:8080${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const img = document.querySelector('.block-image img');
    return {
      hasImage: !!img,
      loaded: img ? img.complete && img.naturalWidth > 0 : false,
      size: img ? `${img.naturalWidth}x${img.naturalHeight}` : '',
      caption: document.querySelector('.block-image figcaption')?.textContent || '',
    };
  });
  console.log(name, JSON.stringify(info));
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.close();
}

await browser.close();
