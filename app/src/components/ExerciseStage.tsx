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
      <div className="exercise-head">
        <span className="exercise-flag">{exercise.type === 'listen' ? '听一听' : '选一选'}</span>
      </div>

      {/* 语音提示独立成行，做成答题区最醒目的元素 */}
      <div className="audio-cue">
        <SpeakButton text={cueText} variant="prompt" label={cueLabel} />
      </div>

      <p className="exercise-stem">{exercise.stem}</p>

      <Scene
        exercise={exercise}
        selected={selected}
        checked={checked}
        disabled={checked}
        onSelect={onSelect}
      />

      {/* 反馈与按钮合并为底部常驻区：两者都贴在视口底部，既不用滚动也能看到反馈 */}
      <div className="exercise-footer">
        {checked && (
          <div className={`feedback ${correct ? 'ok' : 'no'}`}>
            <strong>{correct ? '答对了' : '再试一次'}</strong>
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
    </div>
  );
}
