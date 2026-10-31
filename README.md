# 小一伴学

**XiaoYi Study · 深圳小学一年级家庭学习 H5**

> 跟着深圳教材走，每天十分钟。语文、数学、英语三科，手机和平板都能用，Android 可完全离线。

![status](https://img.shields.io/badge/status-MVP-orange)
![platform](https://img.shields.io/badge/platform-H5%20%7C%20Android-4a86c8)
![content](https://img.shields.io/badge/content-33%20lessons%20%2F%2098%20exercises-46a97c)

「小一」指小学一年级，「伴学」指陪伴式自学。英文名 **XiaoYi Study**，建议 GitHub 仓库名 `xiaoyi-study`。

## 项目简介

本仓库最初是一份关于「深圳一年级 H5 教学项目」的选型调研，现已进入实施阶段：

- **`app/`**：可运行的一年级学习应用，含 H5 与 Capacitor Android 工程。
- **`doc/`**：教材版本核实、选型报告、需求基线与需求决策清单，是产品范围的依据。

产品面向 **6–7 岁学生**，用于家庭自学、课前预习与课后练习。首期只做学生端，不设账号、教师端与社交功能；进度只保存在本机。

内容按深圳现行选用教材组织：语文（人教统编）、数学（北师大版）、英语（沪教版，听说为主）。教材原文与课本版式不复刻，讲解、例句与题目均为自编。

## 主要功能

| 模块 | 说明 |
|---|---|
| 三级导航 | 学科 → 册 → 单元 → 课时；6 册切换，显示课时完成度与得分 |
| 课时学习页 | 学习目标 + 讲解文本 + 识字卡（拼音/组词/点读）+ 单词卡 + 插图 + 纯音频 |
| 练习与判分 | 单选、多选、听音选字；即时对错反馈、答案解析与语音反馈 |
| 可插拔玩法 | 默认「气泡」场景，可切换「卡片」兜底；题目级、用户级、默认、兜底四级解析 |
| 语音 | 优先播放预生成音频，缺失时自动回退浏览器内置语音；数学题提供「读题目」 |
| 进度与草稿 | `localStorage` 记录课时完成与得分；中途退出自动保存，回来可继续 |
| 多端适配 | 手机竖屏、平板横屏、iPad；暖色低刺激视觉，照顾低识字量儿童 |
| 离线能力 | 内容随包分发，Android 端无网可用；H5 为纯静态站点 |
| 内容工具链 | JSON Schema 约束、内容校验、批量 TTS、E2E 与多视口截图 |
| Android 壳 | Capacitor 工程已就位（`com.szg1.study`，minSdk 24 / targetSdk 36） |

### 内容现状

| 学科 | 教材版本 | 已建设 |
|---|---|---|
| 语文 | 人教统编（2024 秋 / 2025 春） | 15 课时 / 44 题 |
| 数学 | 北师大版（2024 秋 / 2025 春） | 10 课时 / 30 题 |
| 英语 | 沪教版（2025 秋 / 2026 春） | 8 课时 / 24 题 |
| **合计** | | **33 课时 / 98 题 / 133 条音频** |

每册目前只建设 2 个单元，不是全册；完整目标为 218 课时，详见 `doc/需求基线v1.md`。

## 技术栈

| 层 | 选型 |
|---|---|
| UI | React 18 + TypeScript 5 |
| 构建 | Vite 5 |
| 样式 | 原生 CSS（CSS 变量 + 媒体查询），无 UI 框架 |
| 路由 | 自实现 Hash 路由 |
| 状态与存储 | React Hooks + `localStorage` |
| 语音 | 预生成 FLAC + Web Speech API 兜底 |
| 原生壳 | Capacitor 8（Android） |
| 内容格式 | JSON + JSON Schema（draft-07） |
| 内容工具 | Python 3（标准库，`pypinyin` 可选）；Ming-3 TTS / Windows SAPI |
| 测试 | Playwright + Chrome；多视口截图 |

## 安装与使用

### 环境要求

| 用途 | 要求 |
|---|---|
| 运行 H5 / 构建 | Node.js **≥ 22**（Capacitor CLI 要求）、npm |
| Android 打包 | JDK 21、Android SDK Platform 36 |
| 内容校验 / TTS | Python 3.10+；`pypinyin` 与 ComfyUI 均为可选 |

### 本地运行

```bash
git clone https://github.com/gbcmikeblue/xiaoyi-study.git
cd xiaoyi-study/app

npm install
npm run dev
```

打开 <http://127.0.0.1:5173>。若本机有多个 Node 版本，请先确认 `node -v` 为 22 及以上。

### 构建与预览

```bash
npm run build     # tsc --noEmit && vite build
npm run preview
```

构建产物在 `app/dist/`，可直接部署到任意静态服务器。`vite.config.ts` 使用相对 `base`，便于 Capacitor 以 `file://` 或自定义 scheme 加载。

### Android 打包

```bash
cd app
npm run build
npx cap sync android
npx cap open android     # 用 Android Studio 构建

# 或使用命令行
cd android
./gradlew assembleDebug  # Windows: .\gradlew.bat assembleDebug
```

APK 输出在 `app/android/app/build/outputs/apk/debug/app-debug.apk`。正式分发需自行配置签名。

### 内容校验与语音生成（可选）

```bash
cd app
python -m pip install pypinyin          # 可选，用于拼音校验
python scripts/validate_content.py
python scripts/tts_batch.py --engine sapi
```

默认 TTS 引擎为 `comfy`，需要本机 ComfyUI；先把 `scripts/tts_config.example.json` 复制为 `scripts/tts_config.json` 并按本机环境修改，离线兜底可用 `sapi`。详见 [`app/README.md`](app/README.md) 与 [`app/docs/voice-clone.md`](app/docs/voice-clone.md)。

## 目录结构

```text
.
├─ README.md
├─ app/                          # 可运行应用
│  ├─ src/
│  │  ├─ pages/                  # Home / Units / Lesson
│  │  ├─ scenes/                 # 答题玩法：bubble / card 与注册表
│  │  ├─ components/             # ExerciseStage / SpeakButton
│  │  ├─ lib/                    # 路由、内容加载、进度、语音、设置
│  │  ├─ types.ts                # 领域类型
│  │  └─ styles.css              # 全局样式与响应式布局
│  ├─ public/content/            # 6 册内容与音频
│  │  ├─ index.json              # 册清单
│  │  ├─ audio-manifest.json     # 文本 → 音频索引
│  │  └─ <volumeId>/             # units.json、课时 JSON、audio/
│  ├─ schema/course.schema.json  # 课程内容 Schema
│  ├─ scripts/                   # 内容校验、TTS、E2E、截图
│  ├─ android/                   # Capacitor Android 工程
│  ├─ docs/                      # 教材目录基准、音色克隆指南
│  ├─ capacitor.config.ts
│  ├─ vite.config.ts
│  └─ package.json
└─ doc/                          # 调研与需求决策
   ├─ 深圳一年级H5教学项目选型报告.md
   ├─ 深圳教材版本核实.md
   ├─ 需求基线v1.md
   └─ 需求决策清单.md
```

## 内容如何扩充

1. 在 `app/public/content/<volumeId>/` 新建课时 JSON，字段见 `app/schema/course.schema.json`。
2. 把课时登记到同目录 `units.json` 的对应单元。
3. 运行 `python scripts/validate_content.py` 校验字段、答案与拼音。
4. 运行 `python scripts/tts_batch.py` 生成音频；音频缺失时前端会自动回退到浏览器朗读。

内容红线：只使用公开教材目录信息，讲解与练习自编；不复制课本原页、课文排版与配套插图。

## 测试

```bash
# 终端 1
cd app && npm run dev

# 终端 2
cd app && node scripts/e2e.mjs     # 24 项端到端断言
node scripts/shot.mjs              # 多视口截图，输出到 .shots/
```

E2E 与截图脚本硬编码了 Chrome 路径与 `http://127.0.0.1:5173`，换机器时请修改脚本顶部的 `CHROME` / `BASE`。

## 已知限制

| 项 | 现状 |
|---|---|
| 内容范围 | 6 册各 2 个单元，共 33 课时 / 98 题；距离 218 课时尚有差距 |
| 英语下册 | 沪教版一下目录未核实，现有单元为早期拟名，需复核后重建 |
| 进度同步 | 仅本机 `localStorage`，换设备或清缓存会丢失 |
| 账号与教师端 | 首期不做 |
| 跟读评分 | 不做（零第三方 SDK 约束） |
| iOS | 仅提供 H5，无原生壳；Safari 真机交互待回归 |
| Android | 工程已接入，尚未产出正式签名 APK，未上架 |
| 音频 | 当前为 Ming-3 合成音色，不是真人克隆 |

## 贡献指南

欢迎提交内容修订、交互优化与文档补充。开始前请先开 Issue 对齐范围，避免大改动返工。

1. Fork 仓库，从 `main` 切出分支：`feat/xxx`、`fix/xxx`、`content/xxx`、`docs/xxx`。
2. 提交信息使用约定式前缀：
   - `feat: 新增气泡场景的多选序号`
   - `fix: 修复草稿恢复后题号错位`
   - `content: 补充语文一上第三单元`
   - `docs: 更新教材目录基准`
3. 提交前自检：
   - `npm run build` 通过；
   - `python scripts/validate_content.py` 无错误；
   - `node scripts/e2e.mjs` 全部通过（涉及前端改动时）。
4. 发起 Pull Request，说明改动范围、验证方式与截图（UI 改动附 `.shots/` 截图）。
5. 不要提交 `node_modules/`、`dist/`、`android/**/build/`、`.shots/` 等生成物。

内容类贡献必须为原创讲解与题目，不得上传教材扫描页、出版社插图或未授权音频。贡献默认按代码 MIT、文档 CC BY 4.0 授权。

## 托管与提交（GitHub）

仓库将托管在 GitHub，账号为 **gbcmikeblue**，提交身份固定为：

| 项 | 值 |
|---|---|
| `user.name` | `gbcmikeblue` |
| `user.email` | `1061589622@qq.com` |

以下示例以仓库名 `xiaoyi-study` 为例，实际仓库名不同请替换 URL。

```bash
# 进入仓库根目录
cd xiaoyi-study

# 首次初始化（已有 .git 则跳过）
git init -b main

# 只对当前仓库设置提交身份（推荐，避免影响本机其他项目）
git config --local user.name "gbcmikeblue"
git config --local user.email "1061589622@qq.com"

# 确认配置
git config --local --get user.name
git config --local --get user.email

# 首次提交并推送到 GitHub
git add .
git commit -m "feat: 初始化小一伴学 H5 与一年级内容"
git remote add origin https://github.com/gbcmikeblue/xiaoyi-study.git
git branch -M main
git push -u origin main
```

后续日常提交：

```bash
git add app/src app/public/content
git commit -m "content: 补充数学一上第三单元"
git push
```

如需 SSH 方式，远程地址改为 `git@github.com:gbcmikeblue/xiaoyi-study.git`。可将 `--local` 换成 `--global` 使配置对本机所有仓库生效，但会覆盖现有全局身份。该邮箱需先在 GitHub 账号的 Emails 中添加并验证，提交才会关联到 `gbcmikeblue`。

核对最近一次提交的作者信息：

```bash
git log -1 --pretty=format:"%h %an <%ae> %s"
```

## 许可与声明

- 仓库暂未添加 `LICENSE` 文件。按 `doc/需求决策清单.md` 中 Q29=C 的决策：**代码采用 MIT，文档采用 CC BY 4.0**，正式开源前请补齐许可文件。
- 教材文本、插图与配套音频版权归各出版社所有；本项目仅使用公开目录信息，讲解、例句、题目与合成语音均为自编或自行生成，不复刻课本原页。
- 使用真人音色克隆前必须取得书面授权，要求见 [`app/docs/voice-clone.md`](app/docs/voice-clone.md)。
- 本项目为非官方学习辅助工具，与深圳市教育部门及各出版社无隶属关系。
