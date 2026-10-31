import { useEffect, useMemo, useState } from 'react';
import { goUnits } from '../lib/router';
import { loadUnits, loadVolumes } from '../lib/content';
import { loadProgress, volumeStats } from '../lib/progress';
import type { ProgressMap, Subject, VolumeMeta } from '../types';

const SUBJECT_LABEL: Record<Subject, string> = {
  chinese: '语文',
  math: '数学',
  english: '英语',
};

const SUBJECT_ORDER: Subject[] = ['chinese', 'math', 'english'];

export default function Home() {
  const [volumes, setVolumes] = useState<VolumeMeta[]>([]);
  const [stats, setStats] = useState<Record<string, { done: number; total: number }>>({});
  const [error, setError] = useState<string | null>(null);
  const progress: ProgressMap = useMemo(() => loadProgress(), [volumes]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await loadVolumes();
        if (!alive) return;
        setVolumes(list);
        const entries = await Promise.all(
          list
            .filter((v) => v.ready)
            .map(async (v) => {
              const units = await loadUnits(v.id);
              const ids = units.flatMap((u) => u.lessons.map((l) => l.id));
              return [v.id, volumeStats(progress, v.id, ids)] as const;
            }),
        );
        if (alive) setStats(Object.fromEntries(entries));
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : '内容加载失败');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="page">
      <header className="hero">
        <p className="hero-kicker">深圳 · 一年级</p>
        <h1 className="hero-title">今天学习哪一科？</h1>
        <p className="hero-sub">点一点，开始今天的十分钟。</p>
      </header>

      {error && <div className="notice notice-error">{error}</div>}

      {SUBJECT_ORDER.map((subject) => {
        const items = volumes.filter((v) => v.subject === subject);
        if (items.length === 0) return null;
        return (
          <section key={subject} className={`subject subject-${subject}`}>
            <h2 className="subject-title">{SUBJECT_LABEL[subject]}</h2>
            <div className="volume-grid">
              {items.map((v) => {
                const stat = stats[v.id];
                const percent = stat && stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;
                return (
                  <button
                    key={v.id}
                    className="volume-card"
                    disabled={!v.ready}
                    onClick={() => goUnits(v.id)}
                  >
                    <span className="volume-term">{v.term === 'up' ? '上册' : '下册'}</span>
                    <span className="volume-edition">
                      {v.edition} {v.editionYear}
                    </span>
                    {v.ready ? (
                      <>
                        <span className="volume-progress">
                          <span className="bar">
                            <span className="bar-fill" style={{ width: `${percent}%` }} />
                          </span>
                          <span className="volume-progress-text">
                            {stat ? `${stat.done}/${stat.total} 课时` : '加载中'}
                          </span>
                        </span>
                      </>
                    ) : (
                      <span className="volume-soon">建设中</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <footer className="page-footer">
        <p>内容依据深圳 2026–2027 学年选用教材整理，仅作学习辅助。</p>
      </footer>
    </main>
  );
}
