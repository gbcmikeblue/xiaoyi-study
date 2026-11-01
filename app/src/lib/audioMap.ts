const BASE = `${import.meta.env.BASE_URL}content/`;

let map: Record<string, string> = {};
let loaded = false;

/** 启动时预加载 TTS 产物清单；文件不存在时静默跳过（回退到浏览器朗读） */
export function preloadAudioMap(): void {
  // 必须绕过缓存：清单会随内容扩充变化，缓存住会导致新音频不生效、
  // 页面悄悄回退到浏览器语音而没有任何报错。
  fetch(`${BASE}audio-manifest.json`, { cache: 'no-cache' })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: Record<string, string> | null) => {
      if (data) {
        map = data;
        loaded = true;
      }
    })
    .catch(() => {
      /* 无音频包，忽略 */
    });
}

export function audioFor(text?: string): string | undefined {
  if (!text || !loaded) return undefined;
  const rel = map[text];
  return rel ? `${BASE}${rel}` : undefined;
}
