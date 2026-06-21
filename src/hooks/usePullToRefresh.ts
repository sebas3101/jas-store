import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 64; // px to trigger refresh
const MAX_PULL  = 80; // px max visual stretch

interface Options {
  onRefresh: () => Promise<void>;
  containerRef?: React.RefObject<HTMLElement>;
}

export function usePullToRefresh({ onRefresh, containerRef }: Options) {
  const [isPulling, setIsPulling]       = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startY      = useRef<number | null>(null);
  const pulling     = useRef(false);

  useEffect(() => {
    const target = containerRef?.current ?? window;

    const getScrollTop = () =>
      containerRef?.current ? containerRef.current.scrollTop : window.scrollY;

    const onTouchStart = (e: Event) => {
      const touch = (e as TouchEvent).touches[0];
      if (getScrollTop() === 0) {
        startY.current = touch.clientY;
      }
    };

    const onTouchMove = (e: Event) => {
      if (startY.current === null || isRefreshing) return;
      const touch = (e as TouchEvent).touches[0];
      const delta = touch.clientY - startY.current;
      if (delta > 0 && getScrollTop() === 0) {
        pulling.current = true;
        setIsPulling(true);
        setPullDistance(Math.min(delta * 0.5, MAX_PULL));
      }
    };

    const onTouchEnd = async () => {
      if (!pulling.current) return;
      const dist = Math.min((startY.current ?? 0), MAX_PULL);
      startY.current  = null;
      pulling.current = false;

      if (pullDistance >= THRESHOLD) {
        setIsPulling(false);
        setIsRefreshing(true);
        setPullDistance(0);
        try { await onRefresh(); } finally { setIsRefreshing(false); }
      } else {
        setIsPulling(false);
        setPullDistance(0);
      }
      void dist;
    };

    target.addEventListener('touchstart', onTouchStart, { passive: true });
    target.addEventListener('touchmove',  onTouchMove,  { passive: true });
    target.addEventListener('touchend',   onTouchEnd,   { passive: true });

    return () => {
      target.removeEventListener('touchstart', onTouchStart);
      target.removeEventListener('touchmove',  onTouchMove);
      target.removeEventListener('touchend',   onTouchEnd);
    };
  }, [onRefresh, isRefreshing, containerRef, pullDistance]);

  return { isPulling, pullDistance, isRefreshing };
}
