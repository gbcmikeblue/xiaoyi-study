let cachedVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    cachedVoice = null;
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  cachedVoice =
    voices.find((v) => v.lang === 'zh-CN' && /Xiaoxiao|Huihui|Yaoyao|female|女/i.test(v.name)) ||
    voices.find((v) => v.lang === 'zh-CN') ||
    voices.find((v) => v.lang.startsWith('zh')) ||
    null;
  return cachedVoice;
}

/** 浏览器内置语音朗读，作为音频文件缺失时的兜底 */
export function speak(text: string, rate = 0.82): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  // 纯 ASCII 文本按英文朗读，避免中英混读时腔调错乱
  const isAscii = /^[\x20-\x7E\s]+$/.test(text);
  utter.lang = isAscii ? 'en-US' : 'zh-CN';
  utter.rate = isAscii ? rate + 0.05 : rate;
  utter.pitch = 1.05;
  const voice = pickVoice();
  if (voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
}

export function stopSpeak(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * 优先播放真实音频文件，缺失或失败时回退到 speechSynthesis。
 * 打样阶段音频尚未生成，全部走兜底，接入 TTS 产物后无需改代码。
 */
export async function playSource(src: string | undefined, fallbackText?: string): Promise<void> {
  if (src) {
    try {
      const audio = new Audio(src);
      await audio.play();
      return;
    } catch {
      // 忽略，走兜底
    }
  }
  if (fallbackText) speak(fallbackText);
}

/** iOS/Safari 需要用户手势后才能出音，页面首次点击时预热 */
export function primeSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoice = undefined;
      pickVoice();
    };
  }
}
