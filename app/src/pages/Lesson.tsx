import { useEffect, useMemo, useState } from 'react';
import { goBack } from '../lib/router';
import ExerciseStage from '../components/ExerciseStage';
import SpeakButton from '../components/SpeakButton';
import { loadLesson } from '../lib/content';
import { clearDraft, loadDraft, recordLesson, saveDraft } from '../lib/progress';
import { audioFor } from '../lib/audioMap';
import { scrollAppToTop } from '../lib/scroll';
import { playLater, playSource, stopAll } from '../lib/speech';
import { getPreferredScene, setPreferredScene } from '../lib/settings';
import { resolveScene, scenesFor } from '../scenes/registry';
import type { Block, Lesson } from '../types';

type Step = 0 | 1 | 2;

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export default function LessonView({ volumeId, lessonId }: { volumeId: string; lessonId: string }) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [score, setScore] = useState(0);
  const [resumeAt, setResumeAt] = useState<{ step: Step; index: number } | null>(null);

  useEffect(() => {
    let alive = true;
    setLesson(null);
    setStep(0);
    setIndex(0);
    setAnswers({});
    setChecked({});
    setResumeAt(null);
    (async () => {
      try {
        const data = await loadLesson(volumeId, lessonId);
        if (!alive) return;
        setLesson(data);
        const draft = loadDraft(volumeId, lessonId);
        if (draft && draft.step === 1 && draft.exerciseIndex < data.exercises.length) {
          setResumeAt({ step: 1, index: draft.exerciseIndex });
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : '课时加载失败');
      }
    })();
    return () => {
      alive = false;
      stopAll();
    };
  }, [volumeId, lessonId]);

  // 草稿自动保存（Q21=B）
  useEffect(() => {
    if (!lesson) return;
    if (step === 2) {
      clearDraft();
      return;
    }
    if (step === 0 && Object.keys(answers).length === 0) return;
    saveDraft({
      volumeId,
      lessonId,
      step,
      exerciseIndex: index,
      answers,
      checked,
      updatedAt: Date.now(),
    });
  }, [lesson, step, index, answers, checked, volumeId, lessonId]);

  const total = lesson?.exercises.length ?? 0;
  const current = lesson?.exercises[index];

  const [preferredScene, setPreferredSceneState] = useState<string | undefined>(() =>
    getPreferredScene(),
  );
  const activeScene = useMemo(
    () => (current ? resolveScene(current, preferredScene) : undefined),
    [current, preferredScene],
  );

  function cycleScene() {
    if (!current) return;
    const list = scenesFor(current.type);
    if (list.length < 2) return;
    const idx = list.findIndex((s) => s.id === activeScene?.id);
    const next = list[(idx + 1) % list.length];
    setPreferredScene(next.id);
    setPreferredSceneState(next.id);
  }

  function startPractice() {
    setResumeAt(null);
    setStep(1);
    setIndex(0);
    scrollAppToTop();
  }

  function applyResume() {
    if (!resumeAt) return;
    const draft = loadDraft(volumeId, lessonId);
    setAnswers(draft?.answers ?? {});
    setChecked(draft?.checked ?? {});
    setIndex(resumeAt.index);
    setStep(1);
    setResumeAt(null);
    scrollAppToTop();
  }

  function restart() {
    clearDraft();
    setAnswers({});
    setChecked({});
    setStep(0);
    setIndex(0);
    setResumeAt(null);
    scrollAppToTop();
  }

  function onSelect(optionId: string) {
    if (!current) return;
    const cur = answers[current.id] || [];
    if (current.type === 'multi') {
      const next = cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId];
      setAnswers({ ...answers, [current.id]: next });
    } else {
      setAnswers({ ...answers, [current.id]: [optionId] });
    }
  }

  function onCheck() {
    if (!current) return;
    setChecked({ ...checked, [current.id]: true });
    const sel = answers[current.id] || [];
    const ok = sameSet(sel, current.answer);
    const feedbackText = ok ? '答对了' : '再试一次';
    void playSource(audioFor(feedbackText), feedbackText);
  }

  function onNext() {
    if (!lesson) return;
    if (index + 1 >= lesson.exercises.length) {
      const finalScore = lesson.exercises.filter((ex) => {
        const sel = answers[ex.id] || [];
        return checked[ex.id] && sameSet(sel, ex.answer);
      }).length;
      setScore(finalScore);
      recordLesson(volumeId, lessonId, {
        status: 'done',
        score: finalScore,
        total: lesson.exercises.length,
        updatedAt: Date.now(),
      });
      setStep(2);
      clearDraft();
      scrollAppToTop();
      const stars = finalScore === lesson.exercises.length ? 3 : finalScore > 0 ? 2 : 1;
      const doneText = stars >= 2 ? '太棒了' : '完成啦';
      void playSource(audioFor(doneText), doneText);
    } else {
      setIndex(index + 1);
      scrollAppToTop();
    }
  }

  if (error) {
    return (
      <main className="page">
        <nav className="topbar">
          <button className="icon-btn" onClick={() => goBack(`#/v/${volumeId}`)} aria-label="返回">
            ←
          </button>
          <span className="topbar-title">出错了</span>
          <span className="icon-btn ghost" />
        </nav>
        <div className="notice notice-error">{error}</div>
      </main>
    );
  }

  if (!lesson) {
    return (
      <main className="page">
        <div className="loading">正在打开课本…</div>
      </main>
    );
  }

  return (
    <main className="page page-lesson">
      <nav className="topbar">
        <button className="icon-btn" onClick={() => goBack(`#/v/${volumeId}`)} aria-label="返回单元">
          ←
        </button>
        <span className="topbar-title">{lesson.title}</span>
        <span className="topbar-count">{step === 1 ? `${index + 1}/${total}` : ''}</span>
      </nav>

      {resumeAt && (
        <div className="notice notice-resume">
          <span>上次学到第 {resumeAt.index + 1} 题，要继续吗？</span>
          <div className="notice-actions">
            <button className="btn small" onClick={restart}>
              重新开始
            </button>
            <button className="btn small primary" onClick={applyResume}>
              继续
            </button>
          </div>
        </div>
      )}

      {step === 0 && (
        <div className="lesson-layout">
          <article className="lesson-main">
            <h1 className="lesson-title">{lesson.title}</h1>
            <ul className="objectives">
              {lesson.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
            {lesson.blocks.map((block, i) => (
              <BlockView key={i} block={block} />
            ))}
          </article>
          <aside className="lesson-side">
            <div className="side-card">
              <p className="side-text">看完就练一练，一共 {total} 道题。</p>
              <button className="btn primary lg block" onClick={startPractice}>
                开始练习
              </button>
            </div>
          </aside>
        </div>
      )}

      {step === 1 && current && (
        <div className="practice-layout">
          <div className="practice-toolbar">
            <div className="practice-progress">
              {lesson.exercises.map((ex, i) => (
                <span
                  key={ex.id}
                  className={`dot${i < index ? ' passed' : ''}${i === index ? ' current' : ''}`}
                />
              ))}
            </div>
            <button className="scene-switch" onClick={cycleScene} title="切换答题玩法">
              {activeScene?.name ?? '玩法'}
            </button>
          </div>
          <ExerciseStage
            exercise={current}
            selected={answers[current.id] || []}
            checked={Boolean(checked[current.id])}
            onSelect={onSelect}
            onCheck={onCheck}
            onNext={onNext}
            isLast={index + 1 >= total}
            preferredScene={preferredScene}
          />
        </div>
      )}

      {step === 2 && (
        <div className="result">
          <div className="result-stars" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`star${
                  i < (score === total ? 3 : score > 0 ? 2 : 1) ? ' filled' : ''
                }`}
              >
                ★
              </span>
            ))}
          </div>
          <h2 className="result-title">{score === total ? '全部答对！' : '完成啦'}</h2>
          <p className="result-score">
            答对 {score} / {total} 题
          </p>
          <div className="result-actions">
            <button className="btn" onClick={restart}>
              再学一遍
            </button>
            <button className="btn primary" onClick={() => goBack(`#/v/${volumeId}`)}>
              回到单元
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function BlockView({ block }: { block: Block }) {
  if (block.type === 'text') {
    return (
      <section className="block block-text">
        {block.title && <h3>{block.title}</h3>}
        <p>{block.content}</p>
      </section>
    );
  }
  if (block.type === 'chars') {
    return (
      <section className="block char-grid">
        {block.items.map((item) => (
          <button
            key={item.char}
            className="char-card"
            onClick={() => {
              void playSource(item.audioSrc ?? audioFor(item.char), item.char);
              if (item.word) {
                playLater(() => {
                  void playSource(audioFor(item.word), item.word);
                }, 900);
              }
            }}
          >
            <span className="char-pinyin">{item.pinyin}</span>
            <span className="char-glyph">{item.char}</span>
            {item.word && <span className="char-word">{item.word}</span>}
          </button>
        ))}
      </section>
    );
  }
  if (block.type === 'words') {
    return (
      <section className="block word-grid">
        {block.items.map((word) => (
          <button
            key={word.text}
            className="word-card"
            onClick={() => {
              void playSource(word.audioSrc ?? audioFor(word.text), word.text);
            }}
          >
            <span className="word-text">{word.text}</span>
            {word.meaning && <span className="word-meaning">{word.meaning}</span>}
          </button>
        ))}
      </section>
    );
  }
  if (block.type === 'image') {
    return (
      <figure className="block block-image">
        <img src={block.src} alt={block.alt} />
        {block.caption && <figcaption>{block.caption}</figcaption>}
      </figure>
    );
  }
  return (
    <section className="block block-audio">
      <SpeakButton text={block.text} src={block.src} size="lg" label={block.caption || '听一听'} />
    </section>
  );
}
