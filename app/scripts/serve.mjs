/**
 * 零依赖静态服务器，供局域网内 iPad / 手机访问。
 *
 * 用法：
 *   node scripts/serve.mjs               # 默认服务 dist/，端口 8080
 *   node scripts/serve.mjs dist 8081     # 指定目录与端口
 *
 * 关键点：必须支持 Range 请求，否则 iOS Safari 播不了 flac。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(process.argv[2] ?? 'dist');
const PORT = Number(process.argv[3] ?? process.env.PORT ?? 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.flac': 'audio/flac',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error(`未找到 ${path.join(ROOT, 'index.html')}，请先执行 npm run build`);
  process.exit(1);
}

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/\/+$/, '');
  const target = path.join(ROOT, clean || '/index.html');
  // 防路径穿越
  if (!target.startsWith(ROOT)) return null;
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    const index = path.join(target, 'index.html');
    if (fs.existsSync(index)) return index;
  }
  // SPA 兜底：没有扩展名的路径都回 index.html（hash 路由用不到，但避免 404）
  if (!path.extname(clean)) return path.join(ROOT, 'index.html');
  return null;
}

const server = http.createServer((req, res) => {
  const file = resolveFile(req.url ?? '/');
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404');
    return;
  }

  const stat = fs.statSync(file);
  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  // index.html 绝不能缓存，否则更新后设备仍加载旧的 hash 资源
  const cache = file.endsWith('.html') ? 'no-cache' : 'public, max-age=3600';
  const range = req.headers.range;

  // Range：音频拖动进度、iOS 播放 flac 依赖它
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      if (start >= stat.size || end >= stat.size || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': cache,
      });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
  }

  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Accept-Ranges': 'bytes',
    'Cache-Control': cache,
  });
  fs.createReadStream(file).pipe(res);
});

function lanAddresses() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) out.push({ name, ip: addr.address });
    }
  }
  return out;
}

server.listen(PORT, '0.0.0.0', () => {
  const addrs = lanAddresses();
  console.log(`静态目录: ${ROOT}`);
  console.log(`本机访问: http://127.0.0.1:${PORT}/`);
  if (addrs.length === 0) {
    console.log('未发现局域网地址，请检查网络连接');
  } else {
    console.log('局域网访问（iPad / 手机用这些地址）:');
    for (const a of addrs) console.log(`  http://${a.ip}:${PORT}/   (${a.name})`);
  }
  console.log('\n按 Ctrl+C 停止。设备需与本机处于同一 WiFi。');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\n已停止');
    server.close(() => process.exit(0));
  });
}
