import { audioFor } from '../lib/audioMap';
import { playSource } from '../lib/speech';

interface Props {
  text: string;
  src?: string;
  size?: 'sm' | 'lg';
  label?: string;
}

export default function SpeakButton({ text, src, size = 'sm', label }: Props) {
  return (
    <button
      type="button"
      className={`speak-btn ${size}`}
      onClick={(e) => {
        e.stopPropagation();
        void playSource(src ?? audioFor(text), text);
      }}
      aria-label={label || `朗读 ${text}`}
    >
      <span className="speak-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor">
          <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zm-2.5-8.6v2.1a7 7 0 0 1 0 13v2.1a9 9 0 0 0 0-17.2z" />
        </svg>
      </span>
      {label && <span className="speak-label">{label}</span>}
    </button>
  );
}
