import type { ComponentType } from 'react';
import type { Exercise, ExerciseType } from '../types';

/**
 * 场景只负责「选项如何呈现与点选」，题干、反馈、按钮由 ExerciseStage 统一提供。
 * 新增玩法只需实现该接口并注册到 registry，无需改动课时页。
 */
export interface SceneProps {
  exercise: Exercise;
  selected: string[];
  checked: boolean;
  disabled: boolean;
  onSelect: (optionId: string) => void;
}

export interface SceneDefinition {
  id: string;
  name: string;
  description: string;
  /** 支持哪些题型；不支持的题型会被自动回退到其它场景 */
  supports: ExerciseType[];
  Component: ComponentType<SceneProps>;
}
