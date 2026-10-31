import type { Draft, LessonRecord, ProgressMap } from '../types';

const PROGRESS_KEY = 'g1.progress.v1';
const DRAFT_KEY = 'g1.draft.v1';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadProgress(): ProgressMap {
  return safeParse<ProgressMap>(localStorage.getItem(PROGRESS_KEY), {});
}

export function saveProgress(map: ProgressMap): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
}

export function recordLesson(volumeId: string, lessonId: string, record: LessonRecord): ProgressMap {
  const map = loadProgress();
  map[volumeId] = map[volumeId] || {};
  map[volumeId][lessonId] = record;
  saveProgress(map);
  return map;
}

export function getLessonRecord(volumeId: string, lessonId: string): LessonRecord | undefined {
  return loadProgress()[volumeId]?.[lessonId];
}

export function volumeStats(
  map: ProgressMap,
  volumeId: string,
  lessonIds: string[],
): { done: number; total: number } {
  const bucket = map[volumeId] || {};
  const done = lessonIds.filter((id) => bucket[id]?.status === 'done').length;
  return { done, total: lessonIds.length };
}

export function loadDraft(volumeId: string, lessonId: string): Draft | undefined {
  const draft = safeParse<Draft | null>(localStorage.getItem(DRAFT_KEY), null);
  if (!draft || draft.volumeId !== volumeId || draft.lessonId !== lessonId) return undefined;
  return draft;
}

export function saveDraft(draft: Draft): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}

export function clearAll(): void {
  localStorage.removeItem(PROGRESS_KEY);
  localStorage.removeItem(DRAFT_KEY);
}
