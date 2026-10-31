/**
 * 通过 WebView 远程调试执行 JS（绕过设备上被丢弃的 input 注入）。
 * 用法：node scripts/cdp.mjs "location.hash"
 * 前置：adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>
 */
const expression = process.argv.slice(2).join(' ');
if (!expression) {
  console.error('用法: node scripts/cdp.mjs "<JS 表达式>"');
  process.exit(1);
}

const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const target = targets.find((t) => (t.url || '').includes('localhost')) ?? targets[0];
if (!target) {
  console.error('没有可调试的页面');
  process.exit(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let seq = 0;
function send(method, params) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;
      ws.removeEventListener('message', onMessage);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    };
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

try {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    console.error('异常:', result.exceptionDetails.text, result.exceptionDetails.exception?.description ?? '');
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(result.result?.value ?? null, null, 2));
  }
} finally {
  ws.close();
}
