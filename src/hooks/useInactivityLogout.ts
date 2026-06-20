import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';

const INACTIVITY_MS  = 10 * 60 * 1000; // 10 minutos
const WARNING_MS     =  1 * 60 * 1000; // aviso 1 min antes

export function useInactivityLogout() {
  const logout      = useAppStore(s => s.logout);
  const currentUser = useAppStore(s => s.currentUser);
  const timer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const reset = () => {
      setShowWarning(false);
      if (timer.current)     clearTimeout(timer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);

      warnTimer.current = setTimeout(() => {
        setShowWarning(true);
      }, INACTIVITY_MS - WARNING_MS);

      timer.current = setTimeout(() => {
        setShowWarning(false);
        logout();
        sessionStorage.setItem('jas_logout_reason', 'inactividad');
      }, INACTIVITY_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(ev => window.addEventListener(ev, reset, { passive: true }));
    reset();

    return () => {
      events.forEach(ev => window.removeEventListener(ev, reset));
      if (timer.current)     clearTimeout(timer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
    };
  }, [currentUser, logout]);

  const stayActive = () => {
    setShowWarning(false);
    window.dispatchEvent(new Event('mousemove'));
  };

  return { showWarning, stayActive };
}
