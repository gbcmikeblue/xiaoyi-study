import { useEffect, useState } from 'react';
import { goHome, goLesson } from '../lib/router';
import { loadUnits, loadVolumes } from '../lib/content';
import { loadProgress } from '../lib/progress';
import type { ProgressMap, UnitMeta, VolumeMeta } from '../types';

export default function Units({ volumeId }: { volumeId: string }) {
  const [volume, setVolume] = useState<VolumeMeta | undefined>();
  const [units, setUnits] = useState<UnitMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const progress: ProgressMap = loadProgress();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [list, unitList] = await Promise.all([loadVolumes(), loadUnits(volumeId)]);
        if (!alive) return;
        setVolume(list.find((v) => v.id === volumeId));
        setUnits(unitList);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : '内容加载失败');
      }
    })();
    return () => {
      alive = false;
    };
  }, [volumeId]);

  const bucket = progress[volumeId] || {};
  const allLessons = units.flatMap((u) => u.lessons);
  const doneCount = allLessons.filter((l) => bucket[l.id]?.status === 'done').length;

  return (
    <main className="page">
      <nav className="topbar">
        <button className="icon-btn" onClick={goHome} aria-label="返回首页">
          ←
        </button>
        <span className="topbar-title">
          {volume ? `${volume.term === 'up' ? '上册' : '下册'} · ${volume.edition}` : '加载中'}
        </span>
        <span className="topbar-count">
          {allLessons.length > 0 ? `${doneCount}/${allLessons.length}` : ''}
        </span>
      </nav>

      {error && <div className="notice notice-error">{error}</div>}

      <div className="unit-list">
        {units.map((unit) => (
          <section key={unit.id} className="unit-block">
            <h2 className="unit-title">
              <span className="unit-index">第 {unit.order} 单元</span>
              <span className="unit-name">{unit.title}</span>
            </h2>
            <ul className="lesson-list">
              {unit.lessons.map((lesson, index) => {
                const record = bucket[lesson.id];
                const done = record?.status === 'done';
                return (
                  <li key={lesson.id}>
                    <button
                      className={`lesson-row${done ? ' is-done' : ''}`}
                      onClick={() => goLesson(volumeId, lesson.id)}
                    >
                      <span className="lesson-order">{index + 1}</span>
                      <span className="lesson-name">{lesson.title}</span>
                      {done ? (
                        <span className="lesson-badge done">
                          {record.score}/{record.total}
                        </span>
                      ) : (
                        <span className="lesson-badge">开始</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
