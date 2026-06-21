import { useRef, useState } from 'react';

interface Options {
  onSwipeRight?: () => void;
  onSwipeLeft?:  () => void;
  threshold?:    number;
}

const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;
const MAX_TRANSLATE  = 100;

export function useSwipeCard({ onSwipeRight, onSwipeLeft, threshold = 80 }: Options) {
  const startX      = useRef(0);
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping,  setIsSwiping]  = useState(false);

  if (!isTouchDevice) {
    return {
      handlers:   {},
      translateX: 0,
      isSwiping:  false,
    };
  }

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - startX.current;
    // Resistencia progresiva más allá del threshold
    const clamped = Math.max(-MAX_TRANSLATE, Math.min(MAX_TRANSLATE, delta));
    setTranslateX(clamped);
  };

  const onTouchEnd = () => {
    setIsSwiping(false);
    if (translateX > threshold && onSwipeRight) {
      onSwipeRight();
    } else if (translateX < -threshold && onSwipeLeft) {
      onSwipeLeft();
    }
    setTranslateX(0);
  };

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    translateX,
    isSwiping,
  };
}
