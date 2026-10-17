// src/components/AppActions.tsx
//
// "Install this app" and "Share" for a barber's (or salon's) app page.
// Install uses the browser prompt where there is one; on iPhone it explains
// Share → Add to Home Screen. Share uses the OS sheet, else copies the link.
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import styles from './AppActions.module.css';

export function AppActions({ name, path }: { name: string; path: string }) {
  const { canInstall, isIos, install } = usePwaInstall();
  const toast = useToast();
  const [showIosHint, setShowIosHint] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.show('Link copied', 'success');
    } catch {
      // Dismissing the OS share sheet rejects; nothing to report.
    }
  };

  return (
    <div className={styles.row}>
      {(canInstall || isIos) && (
        <Button variant="secondary" onClick={canInstall ? install : () => setShowIosHint((v) => !v)}>
          Install {name.split(' ')[0]}&apos;s app
        </Button>
      )}
      <Button variant="ghost" onClick={share}>
        Share
      </Button>
      {showIosHint && (
        <p className={styles.hint} role="note">
          Tap the Share button in Safari, then choose <strong>Add to Home Screen</strong>.
        </p>
      )}
    </div>
  );
}
