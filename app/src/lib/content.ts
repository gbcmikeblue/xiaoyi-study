import type { Lesson, UnitMeta, VolumeMeta } from '../types';

const BASE = `${import.meta.env.BASE_URL}content/`;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`加载失败 ${path} (${res.status})`);
  return (await res.json()) as T;
}

export function loadVolumes(): Promise<VolumeMeta[]> {
  return getJson<VolumeMeta[]>('index.json');
}

export function loadUnits(volumeId: string): Promise<UnitMeta[]> {
  return getJson<UnitMeta[]>(`${volumeId}/units.json`);
}

export function loadLesson(volumeId: string, lessonId: string): Promise<Lesson> {
  return getJson<Lesson>(`${volumeId}/${lessonId}.json`);
}
