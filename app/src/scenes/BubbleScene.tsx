import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { SceneProps } from './types';

interface Bubble {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
  from: string;
  to: string;
}

/** 气泡配色：暖橙、薄荷、天蓝、淡紫、珊瑚、草绿 */
const PALETTE: Array<[string, string]> = [
  ['#ffe9c8', '#ffc978'],
  ['#d9f2e3', '#8fd6ae'],
  ['#dcebfb', '#a5c9f2'],
  ['#f2e6fb', '#c9a8e8'],
  ['#fde8e4', '#f0a99c'],
  ['#eef3d8', '#c3d98a'],
];

/** 漂移速度（px/s）：偏慢，给一年级孩子留出阅读与瞄准时间 */
const SPEED_MIN = 20;
const SPEED_MAX = 34;
/** 正弦浮动幅度与角频率，只影响观感，不参与碰撞 */
const WOBBLE_AMP = 5;
const WOBBLE_W = 1.4;
const EDGE_PAD = 3;
const GAP = 8;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** 半径随文字长度变化：单字 ≈ 36，两字 ≈ 43，三字以上封顶 54 */
function radiusFor(label: string): number {
  const n = label.replace(/\s/g, '').length;
  return Math.min(54, Math.max(36, 26 + n * 8));
}

export default function BubbleScene({ exercise, selected, checked, disabled, onSelect }: SceneProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const wrapRefs = useRef(new Map<string, HTMLDivElement>());
  const bubblesRef = useRef<Bubble[]>([]);
  const sizeRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [reduced, setReduced] = useState(false);

  const paint = useCallback(
    (seconds: number) => {
      for (const b of bubblesRef.current) {
        const el = wrapRefs.current.get(b.id);
        if (!el) continue;
        const ox = reduced ? 0 : Math.sin(seconds * WOBBLE_W + b.phase) * WOBBLE_AMP;
        const oy = reduced ? 0 : Math.cos(seconds * WOBBLE_W * 0.82 + b.phase) * WOBBLE_AMP;
        el.style.transform = `translate3d(${(b.x + ox - b.r).toFixed(2)}px, ${(
          b.y + oy - b.r
        ).toFixed(2)}px, 0)`;
      }
    },
    [reduced],
  );

  const step = useCallback((dt: number) => {
    const { w, h } = sizeRef.current;
    const list = bubblesRef.current;

    for (const b of list) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x - b.r < EDGE_PAD) {
        b.x = b.r + EDGE_PAD;
        b.vx = Math.abs(b.vx);
      } else if (b.x + b.r > w - EDGE_PAD) {
        b.x = w - b.r - EDGE_PAD;
        b.vx = -Math.abs(b.vx);
      }
      if (b.y - b.r < EDGE_PAD) {
        b.y = b.r + EDGE_PAD;
        b.vy = Math.abs(b.vy);
      } else if (b.y + b.r > h - EDGE_PAD) {
        b.y = h - b.r - EDGE_PAD;
        b.vy = -Math.abs(b.vy);
      }
    }

    // 两两分离，避免长时间重叠（选项最多 6 个，代价可忽略）
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const c = list[j];
        const dx = c.x - a.x;
        const dy = c.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const min = a.r + c.r + GAP;
        if (dist < min) {
          const push = (min - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          c.x += nx * push;
          c.y += ny * push;
        }
      }
    }
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      sizeRef.current = { w: rect.width, h: rect.height };
      setSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // 题目或舞台尺寸变化时重新布置
  useEffect(() => {
    if (size.w < 40 || size.h < 40) return;
    const options = exercise.options;
    const n = options.length;
    const centerX = size.w / 2;
    const centerY = size.h * 0.55;

    const list: Bubble[] = options.map((opt, i) => {
      const r = radiusFor(opt.label);
      // 沿椭圆均匀铺开，初始就不重叠，也不会挤在一侧
      const baseAngle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const rx = Math.max(0, centerX - r - 16);
      const ry = Math.max(0, size.h / 2 - r - 18);
      const cx = centerX + Math.cos(baseAngle) * rx * 0.8 + (Math.random() - 0.5) * 14;
      const cy = centerY + Math.sin(baseAngle) * ry * 0.86 + (Math.random() - 0.5) * 12;
      const dir = Math.random() * Math.PI * 2;
      const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
      const [from, to] = PALETTE[i % PALETTE.length];
      return {
        id: opt.id,
        r,
        x: clamp(cx, r + EDGE_PAD, size.w - r - EDGE_PAD),
        y: clamp(cy, r + EDGE_PAD, size.h - r - EDGE_PAD),
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        phase: Math.random() * Math.PI * 2,
        from,
        to,
      };
    });

    bubblesRef.current = list;
    paint(performance.now() / 1000);
  }, [exercise.id, exercise.options, size.w, size.h, paint]);

  useEffect(() => {
    if (reduced || size.w < 40) {
      paint(performance.now() / 1000);
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(40, now - last) / 1000;
      last = now;
      step(dt);
      paint(now / 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [reduced, size.w, size.h, step, paint]);

  const multi = exercise.type === 'multi';

  // 颜色只由选项顺序决定，与位置无关，避免初始化后不刷新
  const colorMap = useMemo(
    () => Object.fromEntries(exercise.options.map((opt, i) => [opt.id, PALETTE[i % PALETTE.length]])),
    [exercise.options],
  );

  return (
    <div className={`bubble-stage${size.w > 0 ? ' is-ready' : ''}`} ref={stageRef}>
      <p className="bubble-hint">点一下会飘的小泡泡，选出你的答案</p>
      {exercise.options.map((opt) => {
        const bubble = bubblesRef.current.find((b) => b.id === opt.id);
        const r = bubble?.r ?? radiusFor(opt.label);
        const picked = selected.includes(opt.id);
        const isAnswer = exercise.answer.includes(opt.id);
        const classes = ['bubble'];
        if (picked) classes.push('is-picked');
        if (checked && isAnswer) classes.push('is-right');
        if (checked && picked && !isAnswer) classes.push('is-wrong');
        if (checked && !isAnswer && !picked) classes.push('is-dim');
        const order = selected.indexOf(opt.id) + 1;
        const [from, to] = colorMap[opt.id] ?? PALETTE[0];
        const cssVars = { '--bub-from': from, '--bub-to': to } as CSSProperties;

        return (
          <div
            key={opt.id}
            className="bubble-wrap"
            style={{ width: r * 2, height: r * 2 }}
            ref={(el) => {
              if (el) wrapRefs.current.set(opt.id, el);
              else wrapRefs.current.delete(opt.id);
            }}
          >
            <button
              type="button"
              className={classes.join(' ')}
              style={cssVars}
              disabled={disabled}
              onClick={() => onSelect(opt.id)}
            >
              <span
                className={`bubble-label${
                  /^[\x20-\x7E\s]+$/.test(opt.label) ? ' is-latin' : ''
                }`}
              >
                {opt.label}
              </span>
              {picked && <span className="bubble-mark">{multi ? order : '✓'}</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}
