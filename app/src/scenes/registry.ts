import BubbleScene from './BubbleScene';
import CardScene from './CardScene';
import type { SceneDefinition } from './types';
import type { Exercise } from '../types';

const registry = new Map<string, SceneDefinition>();

export function registerScene(def: SceneDefinition): void {
  registry.set(def.id, def);
}

export function listScenes(): SceneDefinition[] {
  return Array.from(registry.values());
}

export function getScene(id: string | undefined): SceneDefinition | undefined {
  return id ? registry.get(id) : undefined;
}

/** 默认玩法，新题未指定 scene 时使用 */
export const DEFAULT_SCENE_ID = 'bubble';
/** 最终兜底，任何题型都能渲染 */
export const FALLBACK_SCENE_ID = 'card';

/**
 * 解析顺序：题目自带 scene → 用户偏好 → 默认场景 → 兜底场景。
 * 只要候选场景不支持当前题型，就继续往下找。
 */
export function resolveScene(exercise: Exercise, preferred?: string): SceneDefinition {
  const candidates = [exercise.scene, preferred, DEFAULT_SCENE_ID, FALLBACK_SCENE_ID];
  for (const id of candidates) {
    const def = getScene(id);
    if (def && def.supports.includes(exercise.type)) return def;
  }
  return registry.get(FALLBACK_SCENE_ID)!;
}

/** 该场景能否用于此题型，供设置界面过滤 */
export function scenesFor(type: Exercise['type']): SceneDefinition[] {
  return listScenes().filter((s) => s.supports.includes(type));
}

registerScene({
  id: 'bubble',
  name: '气泡',
  description: '选项装在缓慢漂浮的气泡里，点一下就选中',
  supports: ['single', 'listen', 'multi'],
  Component: BubbleScene,
});

registerScene({
  id: 'card',
  name: '卡片',
  description: '传统的纵向列表，稳定不动',
  supports: ['single', 'listen', 'multi'],
  Component: CardScene,
});
