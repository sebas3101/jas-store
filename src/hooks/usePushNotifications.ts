import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

const DISMISSED_KEY = 'jas_push_dismissed';

export function usePushNotifications() {
  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  const [permission, setPermission]   = useState<NotificationPermission>(() =>
    isSupported ? Notification.permission : 'denied'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [isDismissed, setIsDismissed]   = useState(() =>
    localStorage.getItem(DISMISSED_KEY) === '1'
  );

  useEffect(() => {
    if (!isSupported) return;
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => setIsSubscribed(!!sub))
    );
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !VAPID_PUBLIC_KEY) return;
    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('push_subscriptions').upsert({
        user_id:    user?.id ?? null,
        endpoint:   json.endpoint,
        p256dh:     json.keys.p256dh,
        auth:       json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 200),
      }, { onConflict: 'endpoint' });

      setIsSubscribed(true);
    } catch (err) {
      console.error('[push] subscribe:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      await sub.unsubscribe();
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      setIsSubscribed(false);
    } catch (err) {
      console.error('[push] unsubscribe:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setIsDismissed(true);
  }, []);

  const showBanner =
    isSupported &&
    !isSubscribed &&
    permission !== 'denied' &&
    !isDismissed &&
    !!VAPID_PUBLIC_KEY;

  return { isSupported, permission, isSubscribed, isLoading, showBanner, subscribe, unsubscribe, dismiss };
}
