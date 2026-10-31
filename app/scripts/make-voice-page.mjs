import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('voice-test');
const notes = {
  灵小萌: '有声读物旁白定位，清脆明亮、语速干练 —— 主音色首选',
  灵小柔: '发音清晰标准、语气耐心 —— 适合拼音与识字',
  灵采薇: '温暖知性、育儿科普定位 —— 主音色备选',
  花小呗: '幼态童声、轻快活泼 —— 适合鼓励与陪伴',
  灵思齐: '儿童节目主持人，阳光男声 —— 适合反馈',
  US_Stella: '美式女声，温暖年轻 —— 英语课用',
};

const groups = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => {
    const dir = path.join(root, d.name);
    const files = fs
      .readdirSync(dir)
      .filter((f) => /\.(flac|wav|mp3)$/i.test(f))
      .map((f) => ({ name: d.name, src: `${encodeURIComponent(d.name)}/${encodeURIComponent(f)}` }));
    return { voice: d.name, files };
  })
  .filter((g) => g.files.length > 0);

const cards = groups
  .map(
    (g) => `
  <section class="card">
    <h2>${g.voice}</h2>
    <p class="note">${notes[g.voice] ?? ''}</p>
    <audio controls preload="none" src="${g.files[0].src}"></audio>
  </section>`,
  )
  .join('\n');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Ming-3 候选音色试听</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 28px 20px 60px; background: #fdfaf3; color: #2f2a24;
         font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  .sub { color: #7d7265; font-size: 13px; margin: 0 0 24px; }
  .grid { display: grid; gap: 14px; max-width: 720px; }
  .card { background: #fff; border: 1px solid #ece3d6; border-radius: 16px; padding: 16px 18px;
          box-shadow: 0 6px 20px rgba(120,96,60,.08); }
  .card h2 { margin: 0 0 4px; font-size: 17px; }
  .note { margin: 0 0 10px; font-size: 13px; color: #7d7265; }
  audio { width: 100%; }
  .hint { margin-top: 22px; font-size: 12px; color: #9a8f80; max-width: 720px; line-height: 1.7; }
</style>
</head>
<body>
  <h1>Ming-3 候选音色试听</h1>
  <p class="sub">同一段文本：天在上，地在下，人站在中间。我们一起来读一读。答对了，真棒！</p>
  <div class="grid">${cards}
  </div>
  <p class="hint">说明：全部为 Ming-3.0-tts 0.5B 内置音色的默认（中性）表现，未做语速或情感调整。
  实际使用时可按句子切换情感变体（如 灵小萌_高兴），也可用「音色设计」用文字描述生成定制声线。</p>
</body>
</html>`;

fs.writeFileSync(path.join(root, 'index.html'), html, 'utf-8');
console.log(`已生成 ${path.join(root, 'index.html')}，共 ${groups.length} 个音色`);
