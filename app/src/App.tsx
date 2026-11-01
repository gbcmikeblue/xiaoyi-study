import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import Home from './pages/Home';
import Units from './pages/Units';
import LessonView from './pages/Lesson';
import { initHistoryDepth, notePush, parseHash } from './lib/router';
import type { Route } from './lib/router';

/** 每个页面用稳定的键记录滚动位置 */
function routeKey(route: Route): string {
  if (route.name === 'lesson') return `lesson:${route.volumeId}:${route.lessonId}`;
  if (route.name === 'units') return `units:${route.volumeId}`;
  return 'home';
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const viewportRef = useRef<HTMLDivElement>(null);

  /** 路由键 → 离开时的 scrollTop */
  const positions = useRef<Record<string, number>>({});
  /** 当前页面（离开时要按它存位置） */
  const currentKey = useRef(routeKey(parseHash()));
  /** 本次路由变化是否来自浏览器返回/前进 */
  const isBack = useRef(false);

  // popstate 先于 hashchange 触发，用来标记「这是返回，不是新进入」
  useEffect(() => {
    const onPop = () => {
      isBack.current = true;
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    initHistoryDepth();
    const onHash = () => {
      // 此刻 DOM 还是旧页面，可以拿到真实离开位置
      const vp = viewportRef.current;
      if (vp) positions.current[currentKey.current] = vp.scrollTop;
      // 返回/前进已由 popstate 标记，只有真正的新页面才递增深度
      if (!isBack.current) notePush();
      setRoute(parseHash());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  /*
   * 路由变化后的滚动策略：
   *   - 返回（popstate）：恢复该页面上次离开时的位置（单元列表停在原来的单元）
   *   - 新进入：回到顶部（避免详情页一进来就停在半截，标题被状态栏压住）
   * 连滚两帧：一帧给 React 提交 DOM，一帧给浏览器完成布局后的滚动恢复。
   */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const key = routeKey(route);
    const back = isBack.current;
    isBack.current = false;
    currentKey.current = key;

    const target = back ? (positions.current[key] ?? 0) : 0;
    vp.scrollTop = target;
    const id = requestAnimationFrame(() => {
      vp.scrollTop = target;
    });
    return () => cancelAnimationFrame(id);
  }, [route]);

  let content: ReactElement;
  if (route.name === 'units') {
    content = <Units volumeId={route.volumeId} />;
  } else if (route.name === 'lesson') {
    content = <LessonView volumeId={route.volumeId} lessonId={route.lessonId} />;
  } else {
    content = <Home />;
  }

  return (
    <div className="app-shell">
      {/* 顶部安全区：只为留白，不承载任何可交互元素 */}
      <div className="safe-area safe-area-top" aria-hidden="true" />
      <div className="app-viewport" ref={viewportRef}>
        {content}
      </div>
      {/* 底部安全区：仅为留白，不可点击、不可触摸 */}
      <div className="safe-area safe-area-bottom" aria-hidden="true" />
    </div>
  );
}
