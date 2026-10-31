import type { SceneProps } from './types';

export default function CardScene({ exercise, selected, checked, disabled, onSelect }: SceneProps) {
  const multi = exercise.type === 'multi';

  return (
    <div className={`option-list${multi ? ' multi' : ''}`}>
      {exercise.options.map((opt) => {
        const picked = selected.includes(opt.id);
        const isAnswer = exercise.answer.includes(opt.id);
        const state = checked ? (isAnswer ? 'right' : picked ? 'wrong' : '') : picked ? 'picked' : '';
        return (
          <button
            key={opt.id}
            type="button"
            className={`option ${state}`}
            disabled={disabled}
            onClick={() => onSelect(opt.id)}
          >
            <span className="option-mark">{multi ? (picked ? '✓' : '') : ''}</span>
            <span className="option-label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
