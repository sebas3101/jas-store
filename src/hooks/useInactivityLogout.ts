import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';

const INACTIVITY_MS  = 30 * 60 * 1000; // 30 minutos
const WARNING_MS     = 2  * 60 * 1000; // aviso 2 min antes

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
      if (timer.current)    clearTimeout(timer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);

      warnTimer.current = setTimeout(() => {
        setShowWarning(true);
      }, INACTIVITY_MS - WARNING_MS);

      timer.current = setTimeout(() => {
        setShowWarning(false);
        logout();
        // Mensaje para el login
        sessionStorage.setItem('jas_logout_reason', 'inactividad');
      }, INACTIVITY_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(ev => window.addEventListener(ev, reset, { passive: true }));
    reset(); // arrancar

    return () => {
      events.forEach(ev => window.removeEventListener(ev, reset));
      if (timer.current)    clearTimeout(timer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
    };
  }, [currentUser, logout]);

  const stayActive = () => {
    setShowWarning(false);
    // Disparar mousemove sintético para resetear timers
    window.dispatchEvent(new Event('mousemove'));
  };

  return { showWarning, stayActive };
}
