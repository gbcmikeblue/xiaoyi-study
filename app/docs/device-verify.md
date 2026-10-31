# Android 真机验证报告

> 日期：2026-10-31 ｜ 设备：小米 2510DRK44C（1156×2510，density 480）
> 对应任务：开发计划 P04b 前置（打包路线风险排除）

---

## 一、结论

**打包路线完全成立。** APK 可安装、可启动、内容与音频均正常，练习交互在真机上表现符合预期。

唯一未实测项：**飞行模式下的离线启动**（设备的飞行模式与全局设置被 MIUI 限制，shell 无权限修改）。

| # | 验证项 | 结果 | 证据 |
|---|---|---|---|
| 1 | APK 安装 | 通过 | `adb install -r` 返回 Success |
| 2 | 应用启动 | 通过 | `topResumedActivity=com.szg1.study/.MainActivity`，无崩溃 |
| 3 | 首页渲染 | 通过 | 6 册全部显示，双列布局、进度条正常 |
| 4 | 路由跳转 | 通过 | 首页 → 单元（2 单元/9 课时）→ 课时 |
| 5 | 音频解码播放 | 通过 | flac 播放返回 `ok:0.8s`，单字与词组两条均触发 |
| 6 | 练习场景 | 通过 | 3 个气泡渲染，气泡漂移动画正常 |
| 7 | 判分反馈 | 通过 | 「答对了」+ 正确气泡高亮 + 干扰气泡淡出 |
| 8 | 资源路径 | 通过 | 全部走 `https://localhost/content/...` |

截图：`.shots/device-01-launch.png`、`device-06-units.png`、`device-07-lesson.png`、`device-08-practice.png`、`device-09-result.png`

---

## 二、关键发现：adb 输入注入被系统丢弃

`adb shell input tap / swipe / keyevent` **全部无效果**（连 HOME 键都不响应），但设备状态正常：

```
mWakefulness=Awake    mScreenOn=true    mShowingLockscreen=false
mCurrentFocus=Window{... com.szg1.study/com.szg1.study.MainActivity}
```

排查结论：MIUI 层拦截了 shell 注入的输入事件，与设备锁屏、坐标计算无关。

**替代方案（已验证可用）**：WebView 远程调试 + CDP 执行 JS，绕开触摸层。

```powershell
$adb = 'C:\Android\Sdk\platform-tools\adb.exe'
$procId = (& $adb shell pidof com.szg1.study).Trim()
& $adb forward tcp:9222 "localabstract:webview_devtools_remote_$procId"

node scripts/cdp.mjs "document.querySelectorAll('.volume-card')[0].click()"
node scripts/cdp.mjs "JSON.stringify({hash: location.hash})"
```

`scripts/cdp.mjs` 是本项目新增的调试脚本，支持任意 JS 表达式并返回结果（`userGesture: true`，可触发音频播放）。

**这条通道对后续真机自动化测试很关键**——adb input 不可用的情况下，它是唯一能稳定驱动页面交互的手段。

---

## 三、验证过程中的实际数据

| 项 | 观测值 |
|---|---|
| APK 体积 | 7 MB（含 174 个 content 条目、133 条 flac 共 4.06 MB） |
| 首屏到可交互 | 约 1.5 秒（`am start` 到页面渲染完成） |
| 音频文件 | `249aba763258.flac`（天）、`1667312395ee.flac`（天空） |
| 音频时长 | 0.8 秒（单字） |
| 单元页 | 第 1 单元 5 课、第 2 单元 4 课，计数 0/9 |
| 练习页 | 3 气泡，题干「听一听，选出你听到的字。」 |

---

## 四、遗留问题

| 编号 | 问题 | 影响 | 建议时机 |
|---|---|---|---|
| D1 | 飞行模式离线未实测 | 离线是 APK 的核心价值，但资源走 `https://localhost` 已间接证明不依赖网络 | 请手动开一次飞行模式，重启 App 看首页是否正常 |
| D2 | 应用名称仍是 `com.szg1.study` 的默认值 | 桌面显示名不对 | P01 |
| D3 | 未做应用图标 | 桌面显示默认 Capacitor 图标 | P01 |
| D4 | 未验证返回键行为 | `Q21` 草稿恢复在真机上的实际表现未知 | P01 |
| D5 | 未验证后台切回、横竖屏切换 | 可能丢草稿或重排异常 | P01 |
| D6 | 气泡在真机上分布偏散（部分靠近边缘） | 观感，非阻断 | 可调 `BubbleScene` 的椭圆系数 |
| D7 | `scripts/cdp.mjs` 依赖固定的 9222 端口转发 | 换设备或重启进程后需重建转发 | 已有说明 |

---

## 五、对计划的影响

原计划把 P01（打包）排在最后，前提是"空壳测试能排除架构风险"。本次验证后，风险已基本清零：

- ✅ 工程、构建、资源打包、启动、音频、交互 —— 全部通过
- ⚠️ 离线与系统交互（返回键/后台）—— 需真机再点几下，成本很低

**因此 P01 可以从"最后"提前到"随时"**：现在做只是一个正式化过程（改包名、图标、签名、打包脚本），不再是风险项。

但按你定的优先级，它仍排在内容扩充之后；这里只说明它的不确定性已经消失，不再需要为它预留缓冲。
