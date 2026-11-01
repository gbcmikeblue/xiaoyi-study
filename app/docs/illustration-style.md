# 插图风格规范

> 决策日期：2026-11-01
> 样张预览：`http://127.0.0.1:8080/style-samples.html`

## 一、选型结果

| 角色 | 风格 | 样张 |
|---|---|---|
| **首选（主风格）** | 扁平几何 Flat Geometric | `s01.png` |
| 备选 | 剪纸拼贴 Paper Cut Collage | `s04.png` |
| 备选 | 渐变霓虹 Gradient Neon | `s08.png` |

全部课时插图默认走主风格；备选两种只在特定主题下使用（见 §四）。

## 二、主风格规范

### 色板

| 用途 | 颜色 | 色值 |
|---|---|---|
| 主色（强调、果实、夕阳） | 暖橙 | `#F5871F` |
| 辅色（水面、衣物、器物） | 青绿 | `#1F8A8A` |
| 背景 | 米白 | `#FAF7F0` |
| 轮廓（树干、土地、深色物体） | 深褐 | `#6B4A2F` |
| 点缀（天空、阴影块） | 浅灰蓝 | `#C9D9DC` |

三到五色即可，不追求丰富。**同屏最多出现五色**，多余的颜色会让一年级孩子分不清主次。

### 构图

- **主体偏左或居中**，右侧或上方留出约三分之一的空白承接动势（落叶、飞鸟、风）。
- **平视视角**，不画透视、不画纵深，所有元素贴在同一平面。
- 人物：大头、小身、圆脸，五官只画眼睛和嘴，不画鼻子和耳朵细节。
- 场景元素控制在 5 个以内。

### 禁止项

| 禁止 | 原因 |
|---|---|
| 渐变 | 与平板/低端屏的色带问题叠加，且破坏"色块"语言 |
| 描边 | 描边会让小尺寸显示发糊 |
| 写实质感（纸纹、颗粒、投影） | 与扁平语言冲突 |
| 文字（含中英文字母） | AI 生成文字必出错，文字一律由前端渲染 |
| 复杂背景（多朵云、多座山） | 分散注意力，且与"留白"原则冲突 |

### Prompt 模板

```
Flat vector illustration for a first-grade Chinese textbook, <场景描述>.
Pure flat color blocks, no outlines, no gradients, no texture,
rounded geometric shapes, simple composition,
warm palette of orange #F5871F, teal #1F8A8A, cream #FAF7F0, brown #6B4A2F,
generous negative space on the right, children's textbook style.
```

`<场景描述>` 用英文写，具体到"谁、在哪、做什么"，不要写抽象词（如"秋天"要写成"落叶从树上飘下，天空有一群大雁"）。

## 三、生成方式

用本机 ComfyUI 的 Qwen Image 2.1 链路，单张 1024×1024、25 步、约 22 秒：

```powershell
$COMFY = "C:\Users\Administrator\.codebuddy\skills\comfyui-local\scripts\comfy.py"
python $COMFY t2i "<模板化 prompt>" --width 1024 --height 1024 --seed 42 --out .\public\assets\lessons --json
```

**固定 seed 42**：同一 prompt 可复现，便于换词后对比。

产物是 PNG（约 1–2.5 MB）。批量入库前统一转 WebP：

```powershell
ffmpeg -i cover.png -quality 82 cover.webp
```

WebP 通常能把体积压到 PNG 的三到四成，且现代 WebView 全支持。

## 四、备选风格的使用场景

| 风格 | 用在哪 | 理由 |
|---|---|---|
| **剪纸拼贴** | 节日主题（端午粽、春节）、手工课、劳动教育 | 层叠纸片的手作感与"动手做"的主题契合 |
| **渐变霓虹** | 极少数夜景/科技主题 | 视觉冲击强但气质偏成人，**一年级慎用**，一册不超过两次 |

## 五、接入课时

课时 JSON 里加 `image` 块，位置放在首个 `text` 块之前：

```json
{
  "type": "image",
  "src": "/content/yw-1a/img/u1-l01.webp",
  "alt": "一个人站在天地之间",
  "caption": "天在上，地在下，人在中间"
}
```

前端已有渲染与样式（`.block-image`），不需要改代码。

`alt` 必填——它是读屏软件读的内容，也是图片加载失败时的替代文本。

## 六、体积预算（实测）

首批 5 张的实测压缩率远好于预估：

| 课时 | PNG | WebP（质量 82） | 压缩比 |
|---|---|---|---|
| 天地人 | 750 KB | **18 KB** | 2.4% |
| 走进美丽乡村 | 683 KB | **15 KB** | 2.2% |
| 小小的船 | 711 KB | **21 KB** | 3.0% |
| family | 720 KB | **27 KB** | 3.8% |
| 秋天 | 829 KB | **34 KB** | 4.1% |

原因是扁平几何风格本身色块少、边缘干净，WebP 的有损压缩对这种图特别有效。

| 项 | 数值 |
|---|---|
| 单张 WebP | **15–34 KB**（平均约 23 KB） |
| 若 190 课时各一张 | **约 4.4 MB** |

这个量级下不必再分批——全量插图对 APK 的影响（62.84 → 约 67 MB）远小于音频（24.59 MB）。

**结论：可以全量做，不必只做单元首课。**

## 七、样张文件的处置

`public/assets/style-samples/` 下的 20 个文件（14.5 MB）是选型用的，**不应进 APK**。

风格确定后应移到 `docs/design/` 或删除。当前保留是为了对照，等首批正式插图完成后清理。
