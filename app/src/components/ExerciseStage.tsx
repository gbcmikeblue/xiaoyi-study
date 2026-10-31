import { useMemo } from 'react';
import SpeakButton from './SpeakButton';
import { resolveScene } from '../scenes/registry';
import type { Exercise } from '../types';

interface Props {
  exercise: Exercise;
  selected: string[];
  checked: boolean;
  onSelect: (optionId: string) => void;
  onCheck: () => void;
  onNext: () => void;
  isLast: boolean;
  preferredScene?: string;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export default function ExerciseStage({
  exercise,
  selected,
  checked,
  onSelect,
  onCheck,
  onNext,
  isLast,
  preferredScene,
}: Props) {
  const scene = useMemo(() => resolveScene(exercise, preferredScene), [exercise, preferredScene]);
  const Scene = scene.Component;
  const correct = checked && sameSet(selected, exercise.answer);
  const cueText = exercise.speakText ?? exercise.stem;
  const cueLabel = exercise.speakText ? '点我听一听' : '点我读题目';

  return (
    <div className={`exercise scene-${scene.id}${checked ? ' has-feedback' : ''}`}>
      {/* 题型标识与语音提示合并一行居中，避免头部零散 */}
      <div className="exercise-head">
        <span className="exercise-flag">
          {exercise.type === 'listen' ? '听力' : exercise.type === 'multi' ? '多选' : '单选'}
        </span>
        <SpeakButton text={cueText} variant="prompt" label={cueLabel} />
      </div>

      <p className="exercise-stem">{exercise.stem}</p>

      {/* 判定后选项区整体毛玻璃化，操作按钮直接落在选项区正中，视线与手指都不用移动 */}
      <div className="scene-wrap">
        <Scene
          exercise={exercise}
          selected={selected}
          checked={checked}
          disabled={checked}
          onSelect={onSelect}
        />

        {checked && (
          <div className={`scene-veil ${correct ? 'ok' : 'no'}`}>
            <div className="veil-card">
              <span className="veil-title">{correct ? '答对了' : '再试一次'}</span>
              <button className="btn primary lg" onClick={onNext}>
                {isLast ? '看看成绩' : '下一题'}
              </button>
            </div>
          </div>
        )}
      </div>

      {checked && exercise.explanation && (
        <div className={`feedback ${correct ? 'ok' : 'no'}`}>
          <p>{exercise.explanation}</p>
        </div>
      )}

      {!checked && (
        <div className="exercise-actions">
          <button className="btn primary" disabled={selected.length === 0} onClick={onCheck}>
            确认答案
          </button>
        </div>
      )}
    </div>
  );
}
