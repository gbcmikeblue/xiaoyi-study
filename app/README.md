# app —— 一年级学习 H5

`需求基线v1.md` 的可运行实现。当前处于 W1–W2 骨架阶段：册/单元/课时三级导航、课时学习页、练习判分、本地进度、草稿恢复已跑通；答题交互已改为可插拔的场景架构，默认使用「气泡」玩法。

## 快速开始

本机 Node 未全局升级，项目使用免安装版：

```powershell
$env:PATH = 'D:\tools\node-v22.12.0-win-x64;' + $env:PATH
cd app
npm install
npm run dev        # http://127.0.0.1:5173
```

生产构建与本地预览：

```powershell
npm run build
npm run preview
```

## 目录结构

```
app/
├─ public/content/            # 内容数据，构建时原样拷贝，可被前端 fetch
│   ├─ index.json             # 册清单（6 册，ready 标记是否已建设）
│   ├─ audio-manifest.json    # TTS 产物索引：文本 -> 音频相对路径
│   └─ yw-1a/
│       ├─ units.json         # 单元与课时目录
│       ├─ yw-1a-u1-l01.json  # 课时内容
│       └─ audio/*.flac       # 该册音频
├─ schema/course.schema.json  # 课程内容 JSON Schema
├─ scripts/
│   ├─ validate_content.py    # 内容校验（字段/答案/拼音）
│   ├─ tts_batch.py           # TTS 批量生成（comfy / sapi / edge 三种引擎）
│   ├─ tts_config.example.json
│   ├─ workflows/             # ComfyUI 工作流模板
│   ├─ e2e.mjs                # 端到端测试（Playwright）
│   └─ shot.mjs               # 多视口截图
└─ src/
    ├─ scenes/                # 答题玩法（场景）与注册表
    ├─ lib/                   # 路由、内容加载、进度、语音、音频索引、设置
    ├─ pages/                 # Home / Units / Lesson
    └─ components/            # SpeakButton / ExerciseStage
```

## 答题场景（玩法）

### 已有场景

| id | 名称 | 说明 |
|---|---|---|
| `bubble` | 气泡 | 默认。选项装在缓慢漂浮的气泡里，点一下就选中 |
| `card` | 卡片 | 传统纵向列表，稳定不动，作为兜底 |

### 接口

场景只负责「选项怎么呈现、怎么点」，题干、反馈、确认按钮由 `ExerciseStage` 统一提供：

```ts
// src/scenes/types.ts
export interface SceneProps {
  exercise: Exercise;
  selected: string[];
  checked: boolean;
  disabled: boolean;
  onSelect: (optionId: string) => void;
}

export interface SceneDefinition {
  id: string;
  name: string;
  description: string;
  supports: ExerciseType[];        // 支持哪些题型
  Component: ComponentType<SceneProps>;
}
```

### 新增一个场景

1. 在 `src/scenes/` 下新建组件，实现 `SceneProps`；
2. 在 `src/scenes/registry.ts` 里 `registerScene({ id, name, description, supports, Component })`；
3. 无需改动 `Lesson.tsx`，切换按钮会自动把它列进可选玩法。

`supports` 不包含当前题型时，会按 `resolveScene` 的候选顺序自动回退，不会白屏。

### 解析与切换机制

```
题目自带 exercise.scene  →  用户偏好（localStorage: g1.scene.v1）  →  默认 bubble  →  兜底 card
```

- **内容级**：单个题目可写 `"scene": "card"` 强制指定玩法（`yw-1a-u1-l03` 第 3 题即为例）；
- **用户级**：课时页右上角的场景按钮可循环切换，选择会记住；
- **扩展位**：`ExerciseStage` 的 `preferredScene` 参数已预留，后续接「按册/按单元指定玩法」时只需在上层传值。

## 气泡场景的表现参数

集中在 `src/scenes/BubbleScene.tsx` 顶部常量，便于调参：

| 参数 | 值 | 含义 |
|---|---|---|
| `SPEED_MIN` / `SPEED_MAX` | 20 / 34 px/s | 漂移速度。取值偏慢，给一年级孩子留出阅读与瞄准时间 |
| `WOBBLE_AMP` | 5 px | 正弦浮动幅度，让路径不呆板 |
| `WOBBLE_W` | 1.4 rad/s | 浮动频率 |
| `EDGE_PAD` | 3 px | 撞边留白，反弹而非粘边 |
| `GAP` | 8 px | 两个气泡之间的最小间隙 |
| `radiusFor` | 36–54 px | 半径随文字长度变化（单字 36，三字以上封顶 54） |
| `PALETTE` | 6 组 | 暖橙 / 薄荷 / 天蓝 / 淡紫 / 珊瑚 / 草绿 |

交互细节：

| 状态 | 表现 |
|---|---|
| 点选 | 气泡放大到 1.1，出现橙色光环；多选题在右上角显示选择序号 |
| 正确 | 变绿、弹跳一次、右上角打勾，其余气泡降到 38% 透明度 |
| 错误 | 选中的气泡变红并左右抖动，正确气泡同时变绿高亮 |
| 判定期 | 气泡仍缓慢飘动，但按钮禁用，避免误触改答案 |
| 减少动效 | 系统开启「减少动态效果」时停止动画，改为静态环形排布 |

## TTS

三种引擎，默认 `comfy`（基于 ComfyUI 的开源 TTS 模型）。

### ComfyUI + Ming-3（默认）

通过用户级 skill `comfyui-local` 调用本机 ComfyUI，语音由 **Ming-3.0-tts 0.5B** 生成：
脚本把每条文本交给 `comfy.py run <alias> -p text=... -p voice=...`，由 skill 完成工作流加载
（含 UI→API 转换）、参数绑定、提交、轮询与产物下载，返回音频路径后复制进
`public/content/<vol>/audio/`。前端无感，产物只体现在 `audio-manifest.json`。

**前置条件**：ComfyUI Desktop 需手动启动（skill 不负责启停）。

```powershell
python <skill>\scripts\comfy.py doctor     # server 与 node 均为 true 才可用
```

**配置**：把 `scripts/tts_config.example.json` 复制为 `scripts/tts_config.json`（该文件含本机路径，已被 `.gitignore` 忽略）

| 键 | 当前值 | 说明 |
|---|---|---|
| `alias` | `ming` | `ming` 内置音色 / `ming_clone` 音色克隆 / `tts` SAPI 兜底 |
| `param_text` / `param_voice` | `text` / `voice` | 别名实际使用的参数名，不同工作流不同 |
| `voice_zh` | `灵小萌` | 中文册主音色 |
| `voice_en` | `US_Stella` | 英语册音色 |
| `extra_params` | `{}` | 克隆模式放 `audio` 与 `task.reference_text` |
| `timeout` | `300` | 单条等待上限 |

```powershell
python scripts/tts_batch.py --engine comfy --limit 3   # 先试 3 条
python scripts/tts_batch.py --engine comfy             # 全量
```

**实测数据**（133 条）：单条 3.8–3.9 秒，分三批共约 10 分钟，产物 4.06 MB。

**音色分工**（见 `docs/voice-clone.md` 与 `voice-test/` 试听页）：

| 用途 | 音色 |
|---|---|
| 主音色（讲解、朗读） | 灵小萌 |
| 拼音 / 识字（需极致清晰） | 灵小柔 |
| 答对反馈 | 花小呗 |
| 英语 | US_Stella |

想换成真人老师的声音，见 **[docs/voice-clone.md](docs/voice-clone.md)**（含授权与合规要求）。

### SAPI（离线兜底）

```powershell
python scripts/tts_batch.py --engine sapi
```

使用 Windows 内置中文语音（`Microsoft Huihui Desktop`），零依赖、完全离线，适合打通链路与应急。输出 16 kHz wav，听感偏机械。

### edge（已不可用）

微软已封该接口，调用返回 `403 WSServerHandshakeError`，仅保留代码。

## 内容如何扩充

1. 在 `public/content/<volumeId>/` 下新建课时 JSON，字段见 `schema/course.schema.json`；
2. 登记到同目录 `units.json` 的对应单元 `lessons` 数组；
3. 校验：`python scripts/validate_content.py`；
4. 生成音频：`python scripts/tts_batch.py`。

音频缺失不影响使用：前端会自动回退到浏览器内置语音朗读。

教材内容以**公开目录信息 + 自编讲解与练习**为准，不复制课本原页与课文排版（对应 `Q12` 红线）。当前已建设的课时名为公开教材目录中的篇目，讲解、例句、题目均为自编。

三种区块的用途：

| block | 用途 | 示例 |
|---|---|---|
| `chars` | 识字卡（汉字 + 拼音 + 组词） | 语文识字课 |
| `words` | 单词卡（英文词 + 中文释义） | 英语课 |
| `audio` | 纯听音 | 拼音课 |

没有听力素材的题目（如数学）会在题干下自动出现「读题目」按钮，照顾识字量不足的孩子。

## 测试

```powershell
# 端到端（需先 npm run dev）
node scripts/e2e.mjs

# 多视口截图，输出到 .shots/
node scripts/shot.mjs
```

当前 24 项断言全部通过，覆盖：渲染、默认玩法、场景切换、气泡选中、判对判错、多选序号、成绩页、进度落盘、草稿恢复、单元完成度。

## 已知限制

| 项 | 说明 |
|---|---|
| 内容量 | 六册全部可用：33 课时、98 道题（语文 15 课时 44 题、数学 10 课时 30 题、英语 8 课时 24 题），但每册只覆盖 2 个单元，非全册 |
| TTS 音色 | 当前为 Ming-3 内置音色（灵小萌 · 拟真人），非真人克隆；克隆流程与授权要求见 `docs/voice-clone.md` |
| 气泡场景 | 仅在 Chrome 与 Playwright 中验证；iOS Safari 的合成器行为需真机确认 |
| 账号与同步 | 无（`Q15=A`、`Q17=A`） |
| 跟读评分 | 无（`Q28=A` 零第三方 SDK 的连带结果） |
| 打包 | Capacitor Android 工程已接入，尚未产出正式签名 APK |
