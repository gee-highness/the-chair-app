// src/hooks/usePushSubscription.ts
//
// Turn "new booking" alerts on or off for this device. `status` is
//   'unsupported'  this browser cannot do push (or it is an iPhone tab that is not installed)
//   'unavailable'  the server has no VAPID keys
//   'blocked'      the person denied notifications in the browser
//   'off' | 'on'   the switch
'use client';
import { useCallback, useEffect, useState } from 'react';

export type PushStatus = 'loading' | 'unsupported' | 'unavailable' | 'blocked' | 'off' | 'on';

function toKey(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [busy, setBusy] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (alive) setStatus('unsupported');
        return;
      }
      try {
        const res = await fetch('/api/push/key');
        const { publicKey: key } = res.ok ? await res.json() : { publicKey: null };
        if (!alive) return;
        if (!key) return setStatus('unavailable');
        setPublicKey(key);
        if (Notification.permission === 'denied') return setStatus('blocked');
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (alive) setStatus(existing && Notification.permission === 'granted' ? 'on' : 'off');
      } catch {
        if (alive) setStatus('unsupported');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!publicKey) return false;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'blocked' : 'off');
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) as BufferSource }));
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        await sub.unsubscribe();
        return false;
      }
      setStatus('on');
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [publicKey]);

  const disable = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('off');
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, enable, disable };
}
