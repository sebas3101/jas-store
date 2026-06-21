import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';

const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutos
const WARNING_MS    =  1 * 60 * 1000; // aviso 1 min antes

export function useInactivityLogout() {
  const logout      = useAppStore(s => s.logout);
  const currentUser = useAppStore(s => s.currentUser);
  const timer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActive  = useRef<number>(Date.now());
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const doLogout = () => {
      setShowWarning(false);
      if (timer.current)     clearTimeout(timer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
      logout();
      sessionStorage.setItem('jas_logout_reason', 'inactividad');
    };

    const reset = () => {
      lastActive.current = Date.now();
      setShowWarning(false);
      if (timer.current)     clearTimeout(timer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);

      warnTimer.current = setTimeout(() => setShowWarning(true), INACTIVITY_MS - WARNING_MS);
      timer.current     = setTimeout(doLogout, INACTIVITY_MS);
    };

    // PWA iOS: Safari congela timers cuando la app va al fondo.
    // Al volver al frente, calculamos el tiempo real transcurrido.
    const handleVisibility = () => {
      if (document.hidden) return;
      const elapsed = Date.now() - lastActive.current;
      if (elapsed >= INACTIVITY_MS) {
        doLogout();
      } else {
        // Tiempo restante real — reiniciamos con el tiempo que queda
        const remaining = INACTIVITY_MS - elapsed;
        setShowWarning(false);
        if (timer.current)     clearTimeout(timer.current);
        if (warnTimer.current) clearTimeout(warnTimer.current);
        if (remaining <= WARNING_MS) setShowWarning(true);
        warnTimer.current = remaining > WARNING_MS
          ? setTimeout(() => setShowWarning(true), remaining - WARNING_MS)
          : null;
        timer.current = setTimeout(doLogout, remaining);
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(ev => window.addEventListener(ev, reset, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibility);
    reset();

    return () => {
      events.forEach(ev => window.removeEventListener(ev, reset));
      document.removeEventListener('visibilitychange', handleVisibility);
      if (timer.current)     clearTimeout(timer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
    };
  }, [currentUser, logout]);

  const stayActive = () => {
    setShowWarning(false);
    window.dispatchEvent(new Event('touchstart'));
  };

  return { showWarning, stayActive };
}
