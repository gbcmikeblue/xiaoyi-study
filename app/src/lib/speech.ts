let cachedVoice: SpeechSynthesisVoice | null | undefined;

/**
 * 当前正在播放的文件音频。
 * 必须持有引用：每次 new Audio() 是独立实例，不持有就永远停不掉旧的，
 * 会出现多个声音叠在一起。
 */
let currentAudio: HTMLAudioElement | null = null;

/** 待执行的延迟播放（汉字「先单字、后词语」用），新播放会取消它 */
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

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

function clearPending(): void {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

function stopAudio(): void {
  if (!currentAudio) return;
  const audio = currentAudio;
  currentAudio = null;
  audio.pause();
  try {
    audio.currentTime = 0;
  } catch {
    /* 某些内核在元数据未就绪时会抛错，忽略 */
  }
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

/** 停掉一切声音与待播任务 */
export function stopAll(): void {
  clearPending();
  stopAudio();
  stopSpeak();
}

/**
 * 播放一段音频，同一时刻只允许一个声音。
 *
 * 每次调用会先打断上一个（文件音频、浏览器语音、待播的延迟任务都清掉），
 * 避免连点卡片时多个音轨叠在一起。
 */
export async function playSource(src: string | undefined, fallbackText?: string): Promise<void> {
  stopAll();

  if (src) {
    try {
      const audio = new Audio(src);
      currentAudio = audio;
      audio.addEventListener('ended', () => {
        if (currentAudio === audio) currentAudio = null;
      });
      await audio.play();
      return;
    } catch {
      // 播放失败（文件缺失、解码错误）→ 交给兜底
      if (currentAudio) currentAudio = null;
    }
  }
  if (fallbackText) speak(fallbackText);
}

/**
 * 延迟播放，用于「先读单字、再读词语」这类串联。
 * 期间若发生任何新播放，这个任务会被取消，避免打断后还冒出一段音频。
 */
export function playLater(fn: () => void, delay: number): void {
  clearPending();
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    fn();
  }, delay);
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
