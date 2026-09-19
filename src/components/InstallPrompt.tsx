// src/components/InstallPrompt.tsx
'use client';
import { useEffect, useState } from 'react';
import styles from './InstallPrompt.module.css';

export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('installPromptDismissed') === '1') {
      setDismissed(true);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredEvent(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredEvent || dismissed) return null;

  const install = async () => {
    deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
  };

  const dismiss = () => {
    sessionStorage.setItem('installPromptDismissed', '1');
    setDismissed(true);
  };

  return (
    <div className={styles.banner} role="complementary" aria-label="Install app">
      <span className={styles.text}>Install this app for quicker access and offline booking.</span>
      <div className={styles.actions}>
        <button className={styles.install} onClick={install}>
          Install
        </button>
        <button className={styles.dismiss} onClick={dismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  );
}
