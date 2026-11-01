/** 截取带插图的课时页，确认渲染效果。 */
import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'd:/project/sz-grade1-h5-edu-research/app/.shots';

const cases = [
  ['img-bpmf', '/#/v/yw-1a/l/yw-1a-u2-l03'],
  ['img-jiangnan', '/#/v/yw-1a/l/yw-1a-u5-l02'],
  ['img-weiba', '/#/v/yw-1a/l/yw-1a-u8-l01'],
  ['img-wuya', '/#/v/yw-1a/l/yw-1a-u8-l02'],
  ['img-xiaoxuesheng', '/#/v/yw-1a/l/yw-1a-u0-l01'],
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
