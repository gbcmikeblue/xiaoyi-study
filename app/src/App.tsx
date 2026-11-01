import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import Home from './pages/Home';
import Units from './pages/Units';
import LessonView from './pages/Lesson';
import { parseHash } from './lib/router';
import type { Route } from './lib/router';

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  /*
   * 路由变化后内容整体替换，但浏览器会尝试恢复上一次的滚动位置，
   * 导致新页面一进来就停在半截（标题被状态栏压住）。
   * 这里在渲染后连滚两帧：一帧给 React 提交，一帧给浏览器做完布局。
   */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.scrollTop = 0;
    const id = requestAnimationFrame(() => {
      vp.scrollTop = 0;
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
