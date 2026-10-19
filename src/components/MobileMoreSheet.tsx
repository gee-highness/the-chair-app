// src/components/MobileMoreSheet.tsx
//
// The phone navigation's "More" sheet: a bottom sheet above the tab bar that
// holds every destination that doesn't fit as a tab. Closes on Escape, a tap
// outside, or any navigation. Phones only (the shells hide the trigger on
// desktop, where the sidebar lists everything).
'use client';
import { ReactNode, useEffect, useRef } from 'react';
import styles from './MobileMoreSheet.module.css';

export function MobileMoreSheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    sheetRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div ref={sheetRef} className={styles.sheet} role="dialog" aria-label={label} onClick={(e) => {
        // Tapping a link inside closes the sheet (the page navigates).
        if ((e.target as HTMLElement).closest('a')) onClose();
      }}>
        <div className={styles.grip} aria-hidden="true" />
        <div className={styles.grid}>{children}</div>
      </div>
    </>
  );
}
