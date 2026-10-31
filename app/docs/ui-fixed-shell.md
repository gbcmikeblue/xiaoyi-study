# 固定布局与安全区规范

> 日期：2026-10-31 ｜ 适用：Android APK 与 H5 共用同一套样式

---

## 一、目标

1. 整页固定，不出现上下滑动、橡皮筋、地址栏收放；
2. 顶部预留状态栏高度，底部预留手势条安全区；
3. 两个预留区是**纯空白**，不含任何可点击 / 可触摸 / 可交互对象。

---

## 二、结构

```tsx
<div className="app-shell">
  <div className="safe-area safe-area-top" aria-hidden="true" />
  <div className="app-viewport">{content}</div>
  <div className="safe-area safe-area-bottom" aria-hidden="true" />
</div>
```

三行纵向 flex：

| 元素 | 行为 |
|---|---|
| `.safe-area-top` | `height: var(--safe-top)`，`pointer-events: none` |
| `.app-viewport` | `flex: 1`、`min-height: 0`、`overflow-y: auto` |
| `.safe-area-bottom` | `height: var(--safe-bottom)`，`pointer-events: none` |

页面级锁定：

```css
html, body {
  height: 100%;
  overflow: hidden;
  position: fixed;
  inset: 0;
  overscroll-behavior: none;
}
```

`position: fixed` 是必须的——只用 `overflow: hidden` 在部分 WebView 上仍会出现橡皮筋。

---

## 三、安全区高度

| 变量 | 取值 | 说明 |
|---|---|---|
| `--safe-top` | `max(env(safe-area-inset-top, 0px), 28px)` | 本机实测解析为 **48px**，即真实状态栏高度 |
| `--safe-bottom` | `max(env(safe-area-inset-bottom, 0px), 30px)` | 本机为 **30px**（Android 未提供 inset，取兜底值） |

顶部的 48px 来自 `env(safe-area-inset-top)`——因为 `index.html` 已设置 `viewport-fit=cover`，Android WebView 会把状态栏高度透出。兜底 28px 用于不支持 env 的环境。

底部 30px 是**人为设定**，刚好覆盖手势导航条的触摸区并留一点呼吸。要改只改这一个值：

```css
:root { --safe-bottom: 40px; }
```

想按设备自适应，可在原生层注入真实 inset，或改用 `max(env(safe-area-inset-bottom), 56px)` 的写法（已经如此）。

---

## 四、不可交互的保证

```css
.safe-area {
  pointer-events: none;      /* 不接受点击与触摸 */
  user-select: none;         /* 不可选中 */
  -webkit-tap-highlight-color: transparent;
}
```

外加 `aria-hidden="true"`，读屏软件也会跳过这段空白。

因为安全区是两个独立的 flex 块，内容不会延伸到它们下方，所以 `pointer-events: none` 不会导致"点击穿透到内容"的问题。

---

## 五、真机验证数据（小米 2510DRK44C）

| 项 | 结果 |
|---|---|
| 顶部安全区高度 | 48px，`pointer-events: none` |
| 底部安全区高度 | 30px，`pointer-events: none` |
| `body` 计算样式 | `overflow: hidden`，`position: fixed` |
| 文档可滚动性 | `scrollHeight 836 == clientHeight 836`，不可滚 |
| 执行 `window.scrollTo(0, 200)` 后 | `scrollY` 仍为 0 |
| 内容区滚动到底 | 内容区 `scrollTop=151`，`window.scrollY` 仍为 0，安全区位置不变 |

结论：**页面整体完全锁定，滚动只发生在中间容器内，安全区在任何滚动位置都保持空白且不可交互。**

---

## 六、必须知道的取舍

固定布局意味着**一屏装不下时，内容必须靠内部滚动才能看到**。

例如课时页（讲解 + 汉字卡 + 练习入口）在 1156×2510 的机器上高度约 884px，可视区 733px，需要向下滚 151px 才能看到「开始练习」按钮。

这带来两个选择：

| 方案 | 做法 | 代价 |
|---|---|---|
| **A（当前）** | 页面锁定，内容区可滚 | 内容可达；但用户仍需在内容区内滑动 |
| **B** | 彻底禁止任何滚动 | 内容被裁切且**无法到达**，必须把每页重新设计成一屏 |

如果目标真是 B，需要逐页压缩（缩短讲解、减少卡片、分页展示），不是改一行 CSS 能完成的。

**当前实现选 A**：整页不滑动（不会带动地址栏、不会橡皮筋、不会露出背景），但内容区可以滚动。

如果要把 A 收紧为"仅在必要时可滚"，可以把 `.app-viewport` 的 `overflow-y` 从 `auto` 改为 `hidden`，届时超出一屏的内容会被裁掉——不建议。

---

## 七、涉及文件

| 文件 | 改动 |
|---|---|
| `src/App.tsx` | 新增 `.app-shell` 外壳、安全区、`viewportRef` 路由滚动复位 |
| `src/styles.css` | `html/body` 锁定、`.app-shell` / `.safe-area` / `.app-viewport`、`.page` 内边距调整 |
| `android/.../assets/public` | 需手动同步（见 `android-build.md` 的 cap sync 陷阱） |

---

## 八、界面反馈语音

四条固定反馈语，不在课时 JSON 里，但同样需要固定音色：

| 场景 | 文案 | 文件 |
|---|---|---|
| 答对 | 答对了 | `e76947e20e97.flac` |
| 答错 | 再试一次 | `54116c80e9cb.flac` |
| 满分结算 | 太棒了 | `290ab818989d.flac` |
| 未满分结算 | 完成啦 | `9c6e42ab868e.flac` |

- 文本清单在 `scripts/tts_batch.py` 的 `UI_TEXTS`；
- 产物落在 `public/content/ui/audio/`，与教材内容解耦；
- 前端通过 `audioFor(text)` 查表，命中则播放 Ming-3 音频，未命中才回退浏览器语音。

**文案取值依据**：儿童产品通行做法是"不否定、给指令"——错误反馈用「再试一次」而非「再想想」（后者暗含"你没想清楚"，前者直接给出下一步动作）；结算用口语化的「完成啦」而非「完成练习」（后者像系统提示）。

真机实测（0 分结算）：`Audio.play` 依次命中 `54116c80e9cb.flac` ×3（再试一次）与 `9c6e42ab868e.flac`（完成啦），**全程未调用 speechSynthesis**，音色与课文朗读一致。
