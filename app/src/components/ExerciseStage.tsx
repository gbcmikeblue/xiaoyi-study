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

  return (
    <div className={`exercise scene-${scene.id}`}>
      <div className="exercise-head">
        <span className="exercise-flag">{exercise.type === 'listen' ? '听一听' : '选一选'}</span>
        {exercise.speakText && <SpeakButton text={exercise.speakText} size="lg" />}
      </div>

      <p className="exercise-stem">{exercise.stem}</p>

      {/* 没有听力素材的题目（数学等）也给一个读题入口，照顾识字量不足的孩子 */}
      {!exercise.speakText && (
        <div className="stem-audio">
          <SpeakButton text={exercise.stem} size="sm" label="读题目" />
        </div>
      )}

      <Scene
        exercise={exercise}
        selected={selected}
        checked={checked}
        disabled={checked}
        onSelect={onSelect}
      />

      {checked && (
        <div className={`feedback ${correct ? 'ok' : 'no'}`}>
          <strong>{correct ? '答对了' : '再想想'}</strong>
          {exercise.explanation && <p>{exercise.explanation}</p>}
        </div>
      )}

      <div className="exercise-actions">
        {!checked ? (
          <button className="btn primary" disabled={selected.length === 0} onClick={onCheck}>
            确认答案
          </button>
        ) : (
          <button className="btn primary" onClick={onNext}>
            {isLast ? '看看成绩' : '下一题'}
          </button>
        )}
      </div>
    </div>
  );
}
