# 录音文件目录规范与 ffmpeg 安装

> 适用：拼音真人录音（`split_pinyin.py`）及后续同类音频拆分任务
> 相关：`docs/pinyin-recording.md`（录制与拆分流程）、`docs/dev-env.md`（开发环境）

---

## 一、目录结构

所有**待拆分**的原始录音放在 `app/recordings/`，与构建产物、内容目录完全隔离：

```
app/
├── recordings/                     # 原始录音工作区（不入 git）
│   ├── incoming/                   # 待处理：新录的文件放这里
│   ├── processed/                  # 已处理：拆分成功后自动移入
│   └── rejected/                   # 待重录：拆分失败的手动移入
│
└── public/content/yw-1a/pinyin/    # 拆分产物（入 git，随内容发布）
```

| 目录 | 谁往这里放 | 说明 |
|---|---|---|
| `recordings/incoming/` | 你（录完直接拖进来） | 脚本默认读取这里 |
| `recordings/processed/` | 脚本自动 | 拆分成功后原文件移到此处，命名加时间戳前缀 |
| `recordings/rejected/` | 你（手动） | 拆分失败、需要重录的，放这里避免与待处理混淆 |
| `public/content/yw-1a/pinyin/` | 脚本自动 | 只放拆分后的成品，与内容一起打包发布 |

**为什么把原始录音放在 `public/` 之外**：`public/` 下的文件会被原样打进 APK 和 H5。一段 2.5 分钟的原始录音约 5 MB，放进去既浪费包体，也把老师未剪辑的声音一起发出去了，没有必要。

`recordings/` 已加入 `.gitignore`，不会进仓库。

---

## 二、文件命名规则

```
pinyin-<日期>-<朗读者>-<轮次>.wav
```

| 段 | 格式 | 示例 |
|---|---|---|
| 前缀 | 任务类型 | `pinyin` |
| 日期 | `YYYYMMDD` | `20261101` |
| 朗读者 | 拼音或英文短名 | `lilaoshi` |
| 轮次 | 两位数字 | `01`、`02` |

完整示例：

```
recordings/incoming/pinyin-20261101-lilaoshi-01.wav
recordings/incoming/pinyin-20261101-lilaoshi-02.wav   # 第一遍读错，重录
recordings/incoming/pinyin-20261108-wanglaoshi-01.wav # 换一位老师
```

**为什么要带日期和轮次**：拆分脚本会按时间戳归档到 `processed/`，如果原始文件名都叫 `录音.wav`，归档后就变成 `20261101-101500-录音.wav`、`20261101-102000-录音.wav`，事后分不清哪个是哪一次。带上日期与轮次，归档后仍然可读。

**文件名只用 ASCII**：避免中文与空格在命令行、ffmpeg 参数、Python 路径处理中出编码问题。朗读者用拼音即可。

---

## 三、目录组织方式

### 3.1 一次录一条，一次处理一条

`incoming/` 里**同时只放一个**待处理的 wav。脚本在省略 `--input` 时会自动取唯一那个文件；如果放了两个以上，会拒绝执行并列出文件名：

```
incoming 下有 2 个 wav（pinyin-...-01.wav、pinyin-...-02.wav），请用 --input 指定一个。
```

这样设计是为了防止"以为在处理今天的录音，实际处理了上周没删的旧文件"。

### 3.2 处理成功的流转

```
incoming/pinyin-20261101-lilaoshi-01.wav
        ↓ 拆分成功
processed/20261031-212514-pinyin-20261101-lilaoshi-01.wav
        ↓
public/content/yw-1a/pinyin/01-b.wav … 63-ying.wav
```

归档时自动加时间戳前缀，同一个文件重复处理也不会覆盖。

### 3.3 处理失败的处理

脚本在段数不匹配时**不写任何文件、也不移动原文件**，原录音留在 `incoming/`，你可以直接重跑调参，或听后决定重录。

确认要重录的，手动移到 `rejected/`，并在文件名后加原因：

```
recordings/rejected/pinyin-20261101-lilaoshi-01-停顿太短.wav
```

---

## 四、注意事项

| 项 | 说明 |
|---|---|
| 格式 | 必须是 **16-bit PCM 的 WAV**。m4a / mp3 / 24-bit wav 都需要先转码（见第五章） |
| 采样率 | 16 kHz 以上，44.1 kHz 也可以；脚本会保留原采样率 |
| 声道 | 单声道或立体声都支持，立体声会自动混成单声道 |
| 目录不要手动改名 | `incoming` / `processed` / `rejected` 三个名字被脚本与文档引用 |
| 不要放在 `public/` | 原始录音不进发布包 |
| 不要放进 `dist/` | 每次 build 会被清空 |
| 空间占用 | 单条 2.5 分钟 16 kHz 单声道约 5 MB；`processed/` 定期清理即可 |

---

## 五、ffmpeg 的下载与安装

> **本机状态：已安装。** 2026-10-31 装好 `ffmpeg 9.0.2-essentials_build`，路径：
> ```
> D:\tools\ffmpeg-9.0.2-essentials_build\bin\ffmpeg.exe
> ```
> 已验证 flac 解码、wav 编码、flac 编码均正常。未加入系统 PATH（避免污染环境），
> 需要时用全路径，或在当前会话临时加：
> ```powershell
> $env:PATH = 'D:\tools\ffmpeg-9.0.2-essentials_build\bin;' + $env:PATH
> ffmpeg -version
> ```

以下内容保留备查，用于换机器或需要重装时。

只有需要转码时才用得上（m4a → wav，或 wav → flac 压缩）。纯 wav 录制 + 拆分不需要 ffmpeg。

### 5.1 该下哪种格式

| 项 | 应选 |
|---|---|
| 操作系统 | **Windows x64** |
| 包类型 | **静态编译的 zip 免安装包**（不是安装器 `.exe`，不是源码） |
| 解压后内容 | `ffmpeg-<版本>-essentials_build/bin/ffmpeg.exe` |
| 大小 | 约 110–170 MB（essentials）/ 约 400 MB（full，含更多编码器） |

选 zip 而不是安装器的原因：免安装、不写注册表、不污染 PATH，解压到 `D:\tools` 后按需临时调用即可，与项目里已有的 Node 22 保持同一种方式。

### 5.2 下载地址

**首选（Windows 主流构建，实测可访问，114 MB）：**

```
https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
```

构建列表页（可选 full 版、7z 压缩版）：

```
https://www.gyan.dev/ffmpeg/builds/
```

**备选（GitHub 上的自动化构建，含更多编解码器）：**

```
https://github.com/BtbN/FFmpeg-Builds/releases
```

选最新的 `ffmpeg-master-latest-win64-gpl.zip`。

**官方总入口：**

```
https://ffmpeg.org/download.html
```

> 本机实测：`ffmpeg.org` 直连会握手失败，`gyan.dev` 与 `github.com/BtbN` 可正常访问。若 gyan.dev 下载中途断开，换 BtbN 的链接或过一会儿重试。

### 5.3 安装步骤

```powershell
# 1. 下载
Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' `
  -OutFile 'D:\tools\ffmpeg.zip' -UseBasicParsing

# 2. 解压（会生成形如 ffmpeg-7.x-essentials_build 的目录）
Expand-Archive -Path 'D:\tools\ffmpeg.zip' -DestinationPath 'D:\tools' -Force

# 3. 验证
$exe = (Get-ChildItem 'D:\tools' -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1).FullName
& $exe -version
```

### 5.4 常用命令

**m4a → wav（iPhone 录音转码，拆分前必做）**

```powershell
& $exe -i 录音.m4a -ac 1 -ar 16000 -acodec pcm_s16le pinyin.wav
```

| 参数 | 作用 |
|---|---|
| `-ac 1` | 转单声道，减小体积、避免脚本混音 |
| `-ar 16000` | 采样率 16 kHz，语音足够，体积是 44.1 kHz 的三分之一 |
| `-acodec pcm_s16le` | 16-bit PCM，脚本只接受这个格式 |

**wav → flac（拆分后压缩，体积约降到三分之一）**

```powershell
& $exe -i 01-b.wav -c:a flac 01-b.flac
```

**查看音频信息**

```powershell
& $exe -i pinyin.wav
```

重点看输出里的 `Stream #0:0` 一行：`pcm_s16le` 表示格式正确，`24000 Hz, mono` 表示采样率与声道。

### 5.5 如果装不上

三个源都失败时（此前遇到过 `ECONNRESET` 与流中断）：

- 用别人机器下载后拷过来，zip 免安装，直接解压即可；
- 或先不转码：把手机录音 App 设为 WAV 输出，跳过 ffmpeg；
- 或在线转换（不要上传含学生声音的素材，仅限本人录音）。

---

## 六、完整操作流程（速查）

```powershell
cd d:\project\sz-grade1-h5-edu-research\app

# 1. 把录音放进 incoming（文件名按规范）
#    recordings\incoming\pinyin-20261101-lilaoshi-01.wav

# 2. 若是 m4a，先转码
#    & $ffmpeg -i 录音.m4a -ac 1 -ar 16000 -acodec pcm_s16le recordings\incoming\pinyin-20261101-lilaoshi-01.wav

# 3. 预览切分（不写文件）
python scripts/split_pinyin.py --dry-run

# 4. 正式拆分（成功后原录音自动归档到 processed）
python scripts/split_pinyin.py

# 5. 检查产物
Get-ChildItem public\content\yw-1a\pinyin -Filter *.wav | Measure-Object
```
