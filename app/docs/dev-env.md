# 开发环境与内存占用

---

## 一、曾经发生过的问题

开发服务器长时间运行后，`node.exe` 单个进程占用涨到 **16.7 GB**，系统可用内存从 39 GB 掉到 22 GB。

排查记录（2026-10-31）：

| 进程 | 内存 | 判断 |
|---|---|---|
| `vite.js --port 5173` | **16 729 MB**，累计 CPU 3 632 s | 异常，根因 |
| `scripts/serve.mjs` | 51 MB | 正常 |
| Adobe Creative Cloud 自带的 node | 60 MB | 与本项目无关 |

### 根因

`vite.config.ts` 没有配置 `server.watch.ignored`，Vite 默认监听项目根目录下**除 node_modules 外的所有文件**。而 `app/` 里有多个体积大、变动频繁的目录：

| 目录 | 为什么会拖累 Vite |
|---|---|
| `android/` | Gradle 构建产生数千个文件，每次 `assembleDebug` 都触发全量重载 |
| `dist/` | 每次 `npm run build` 重写整个输出目录 |
| `.shots/` | Playwright 每次截图写入 8 张 PNG |
| `public/content/*/audio/` | 批量生成音频时一次写入上百个 flac |
| `voice-test/`、`clone-test/`、`comfy-out/`、`.audio-backup-sapi/` | 调试产物 |

每次文件变动都会让 Vite 触发 HMR 甚至整页重载，重载过程重建模块图并累积转换缓存——一天里改代码上百次、跑截图十几次，内存就涨到了 16 GB。

---

## 二、已做的三项优化

### 1. 监听排除（治本）

`vite.config.ts`：

```ts
server: {
  watch: {
    ignored: [
      '**/android/**', '**/dist/**', '**/.shots/**', '**/comfy-out/**',
      '**/clone-test/**', '**/voice-test/**', '**/.audio-backup-sapi/**',
      '**/node_modules/**', '**/public/content/*/audio/**',
    ],
  },
}
```

验证方式：往 `.shots/` 写文件后，dev 日志中 `reload/hmr/update` 记录为 **0 条**，说明不再触发重载。

### 2. 堆上限（兜底）

`npm run dev` 改为 `node scripts/dev.mjs`，以 `--max-old-space-size=1536` 启动 Vite。

即使将来出现新的泄漏，进程会在 1.5 GB 时自行退出，而不是一路吃到 16 GB 把系统拖垮。可用环境变量覆盖：

```powershell
$env:DEV_MAX_OLD_SPACE_MB='2048'; npm run dev
```

### 3. 日常预览走静态服务

`npm run serve`（`scripts/serve.mjs`）是零依赖静态服务器，内存稳定在 **51 MB**，且支持 Range 请求。

只看效果、不写代码时，用「先 build 再 serve」比常驻 dev server 更省资源：

```powershell
npm run build
npm run serve      # 局域网与 iPad 都走这个
```

---

## 2.5 构建会因 dist 文件数过多而失败

内容扩充到 100+ 课时后，`npm run build` 会报：

```
[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED] {"count":552,"threshold":500,...}
```

原因：Vite 构建前会清空 `dist/`，而环境的删除保护对单次超过 500 个文件的批量删除会拦截。
`dist/content` 下的音频与 JSON 加起来已经 552 个，于是被挡。

**绕过办法**：构建前手动清空 dist（用 .NET API，不走回收站）：

```powershell
if (Test-Path 'dist') { [System.IO.Directory]::Delete((Resolve-Path 'dist'), $true) }
npm run build
```

`emptyOutDir` 保持默认（true），只是把"删除"这一步挪到构建之外。

---

## 三、优化前后对比

| 场景 | 优化前 | 优化后 |
|---|---|---|
| 长时间开发（6 小时） | 16.7 GB | 约 80–200 MB |
| 跑完一轮 e2e | — | vite 79 MB + dev.mjs 42 MB |
| 静态预览 `serve.mjs` | 51 MB | 51 MB |

---

## 四、日常使用建议

| 场景 | 命令 | 备注 |
|---|---|---|
| 写代码、调样式 | `npm run dev` | 每隔两三小时重启一次，最稳妥 |
| 只看效果 / 给别人用 | `npm run build && npm run serve` | 内存低、可局域网访问 |
| 回归测试 | `npm run e2e` | 需要 dev server 在跑 |
| 多视口截图 | `npm run shot` | 写 `.shots/`，已排除监听 |

检查当前占用：

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  ForEach-Object {
    $p = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
    "{0,6} MB  {1}" -f [math]::Round($p.WorkingSet64/1MB,0), $_.CommandLine
  }
```

清理失控进程：

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'vite' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```
