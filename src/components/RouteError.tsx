// src/components/RouteError.tsx
//
// Shared body for error.tsx boundaries. Nested boundaries (dashboard, admin)
// keep their shell visible and only replace the page area, so one failing
// screen doesn't strand staff outside their navigation.
'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import styles from '@/components/error-page.module.css';

export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={styles.container} role="alert">
      <h1 className={styles.title}>Something went wrong</h1>
      <p className={styles.description}>
        This page hit a problem. Your data is safe. Try again, or use the menu to go somewhere else.
      </p>
      <div className={styles.actions}>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
