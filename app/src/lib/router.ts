export type Route =
  | { name: 'home' }
  | { name: 'units'; volumeId: string }
  | { name: 'lesson'; volumeId: string; lessonId: string };

export function parseHash(): Route {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'v' && parts[1] && parts[2] === 'l' && parts[3]) {
    return { name: 'lesson', volumeId: parts[1], lessonId: parts[3] };
  }
  if (parts[0] === 'v' && parts[1]) {
    return { name: 'units', volumeId: parts[1] };
  }
  return { name: 'home' };
}

/*
 * 导航深度：放在 history.state 里，跟着每条历史记录走。
 * 用它判断「还有没有本应用内的上一页」，从而决定返回是 back() 还是直接跳转。
 */
interface NavState {
  depth?: number;
}

function currentDepth(): number {
  return (window.history.state as NavState | null)?.depth ?? 0;
}

/** 应用启动时初始化当前记录的深度 */
export function initHistoryDepth(): void {
  const state = (window.history.state ?? {}) as NavState;
  if (state.depth === undefined) {
    window.history.replaceState({ ...state, depth: 0 }, '');
  }
}

/** 前进到新页面后调用，把新记录的深度标为上一页 +1 */
export function notePush(): void {
  const state = (window.history.state ?? {}) as NavState;
  window.history.replaceState({ ...state, depth: currentDepth() + 1 }, '');
}

export function goHome(): void {
  window.location.hash = '#/';
}

export function goUnits(volumeId: string): void {
  window.location.hash = `#/v/${volumeId}`;
}

export function goLesson(volumeId: string, lessonId: string): void {
  window.location.hash = `#/v/${volumeId}/l/${lessonId}`;
}

/**
 * 返回上一页。
 *
 * 有应用内历史时走 `history.back()`，这样会触发 `popstate`，
 * 上层才能识别「这是返回」并恢复离开时的滚动位置。
 * 若当前是入口页（深度为 0，比如冷启动直达课时），退回 fallback。
 */
export function goBack(fallback: string): void {
  if (currentDepth() > 0) {
    window.history.back();
  } else {
    window.location.hash = fallback;
  }
}
