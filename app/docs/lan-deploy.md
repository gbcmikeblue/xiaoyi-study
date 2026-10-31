# 局域网 H5 部署

> 对应决策：`N12=B`（内网部署）、`N15=A`（iPad 需联网使用）
> 用途：让 iPad / 手机在家庭 WiFi 下打开同一份内容，不经过任何公网服务

---

## 一、启动

```powershell
$env:PATH = 'D:\tools\node-v22.12.0-win-x64;' + $env:PATH
cd d:\project\sz-grade1-h5-edu-research\app

npm run build                 # 有改动时先构建
node scripts/serve.mjs        # 默认 dist/ + 8080 端口
```

启动后会打印所有可用地址：

```
静态目录: D:\...\app\dist
本机访问: http://127.0.0.1:8080/
局域网访问（iPad / 手机用这些地址）:
  http://192.168.31.248:8080/   (以太网)
  http://172.30.80.1:8080/      (vEthernet (WSL))
  ...
```

指定目录与端口：

```powershell
node scripts/serve.mjs dist 8081
```

---

## 二、该用哪个地址

列表里通常有多个网卡，只有一个是真正的局域网：

| 前缀 | 来源 | 是否可用 |
|---|---|---|
| `192.168.x.x` | 家用路由器 / WiFi | **用这个** |
| `172.17~172.30.x.x` | Docker / WSL / Hyper-V 虚拟网卡 | 手机连不上 |
| `198.18.x.x` | 代理软件（Clash 等）的虚拟网卡 | 手机连不上 |
| `192.168.11.x` / `192.168.200.x` | VMware 虚拟网卡 | 手机连不上 |

判断方法：看括号里的网卡名，带「以太网」「WLAN」「Wi-Fi」的才是真实网卡。

**确认同网段**：手机 WiFi 的 IP 前三位应与该地址一致。本机实测手机 `192.168.31.35`、电脑 `192.168.31.248`，同网段，可直接访问。

---

## 三、设备端打开

在 iPad / 手机的浏览器地址栏输入 `http://192.168.31.248:8080/`。

iPad 可「共享 → 添加到主屏幕」，借助 `apple-mobile-web-app-capable` 全屏打开，此时安全区会按真实状态栏高度生效。

---

## 四、与 APK 的差异

| 项 | APK（Capacitor） | 局域网 H5（浏览器） |
|---|---|---|
| 顶部安全区 | 48px（真实状态栏高度） | 12px（浏览器已有地址栏） |
| 底部安全区 | 30px | 8px（浏览器已有工具栏） |
| 离线 | 完全离线 | 需连同一 WiFi |
| 全屏 | 是 | 添加到主屏后近似全屏 |

安全区按环境区分的实现：`main.tsx` 检测 `Capacitor.isNativePlatform()`，非原生环境给 `<html>` 加 `.is-web`，CSS 里覆盖 `--safe-top` / `--safe-bottom`。

---

## 五、防火墙

首次启动时 Windows 可能弹出「是否允许 Node.js 通过防火墙」，**必须勾选专用网络**，否则手机访问会超时。

若已误点取消，手动放行：

```powershell
New-NetFirewallRule -DisplayName "Study H5 8080" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow -Profile Private
```

需要管理员权限。

---

## 六、IP 会变

路由器默认 DHCP，电脑重启后 IP 可能从 `.248` 变成别的，iPad 收藏的地址就失效了。

三种处理方式（按成本排序）：

1. **路由器里绑定 MAC-IP**（推荐）—— 登录路由器后台，把本机 MAC 固定到 `192.168.31.248`；
2. Windows 设置静态 IP —— 控制面板 → 网络适配器 → IPv4 属性，需同时填对网关与 DNS；
3. 每次重启后看日志里的新地址 —— 最省事但每次要改收藏。

---

## 七、停止与常驻

- `Ctrl+C` 停止；
- 需要长期运行时，用计划任务开机自启：

```powershell
$action  = New-ScheduledTaskAction -Execute 'D:\tools\node-v22.12.0-win-x64\node.exe' `
  -Argument 'scripts\serve.mjs' -WorkingDirectory 'D:\project\sz-grade1-h5-edu-research\app'
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName 'StudyH5' -Action $action -Trigger $trigger -RunLevel Limited
```

---

## 八、为什么不用 `vite preview`

`vite preview` 能用，但有两个问题：

1. 它面向预览而非长期服务，重启后端口与进程管理麻烦；
2. 自建服务可以精确控制 **Range 请求**——iOS Safari 播放 flac 依赖 `206 Partial Content`，这是必须在真机上验证过的点。

`scripts/serve.mjs` 实测结果：

```
带 Range:  HTTP/1.1 206 Partial Content
           Content-Range: bytes 0-1023/28864
           Accept-Ranges: bytes
整文件:    200, 28864 字节
JSON:      200, application/json; charset=utf-8
```
