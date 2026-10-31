const SCENE_KEY = 'g1.scene.v1';

/** 用户偏好的答题玩法；题目自身指定 scene 时以题目为准 */
export function getPreferredScene(): string | undefined {
  return localStorage.getItem(SCENE_KEY) ?? undefined;
}

export function setPreferredScene(id: string): void {
  localStorage.setItem(SCENE_KEY, id);
}
