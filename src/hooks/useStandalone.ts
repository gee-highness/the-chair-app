// src/hooks/useStandalone.ts
//
// True when the page is running as an installed app (home-screen icon, own
// window) rather than in a browser tab. False on the server and for the first
// client render, so server and client markup match.
'use client';
import { useEffect, useState } from 'react';

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);
}

export function useStandalone(): boolean {
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    setStandalone(isStandalone());
    const mq = window.matchMedia?.('(display-mode: standalone)');
    if (!mq?.addEventListener) return;
    const onChange = () => setStandalone(isStandalone());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return standalone;
}
