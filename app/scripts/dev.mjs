/**
 * 带内存上限的开发服务器启动器。
 *
 * 背景：Vite 5 的 dev server 长时间运行 + 高频 HMR 会导致模块图与转换缓存持续增长，
 * 实测一次会话可以涨到 16 GB 以上。给它一个堆上限，超限时进程会自行退出而不是吃满内存。
 *
 * 用法：npm run dev
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

const MAX_OLD_SPACE_MB = process.env.DEV_MAX_OLD_SPACE_MB ?? '1536';
const PORT = process.env.DEV_PORT ?? '5173';

const viteBin = path.join('node_modules', 'vite', 'bin', 'vite.js');
const args = [viteBin, '--port', PORT, '--host', '127.0.0.1'];

console.log(`[dev] Vite 启动中：端口 ${PORT}，堆上限 ${MAX_OLD_SPACE_MB} MB`);
console.log('[dev] 长时间开发建议每隔两三小时重启一次；日常预览请用 npm run serve');

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--max-old-space-size=${MAX_OLD_SPACE_MB}`]
      .filter(Boolean)
      .join(' '),
  },
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
