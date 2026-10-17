// src/components/DisplayMenu.tsx
//
// "Display" popover in the footer: light/dark/system theme, text size, high
// contrast and reduced motion. Choices are saved on this device only
// (lib/displayPrefs.ts) and applied as attributes on <html>.
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_DISPLAY_PREFS,
  DISPLAY_PREFS_KEY,
  DisplayPrefs,
  applyDisplayPrefs,
  parseDisplayPrefs,
} from '@/lib/displayPrefs';
import styles from './DisplayMenu.module.css';

function readSaved(): DisplayPrefs {
  try {
    return parseDisplayPrefs(localStorage.getItem(DISPLAY_PREFS_KEY));
  } catch {
    return DEFAULT_DISPLAY_PREFS;
  }
}

export function DisplayMenu() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<DisplayPrefs>(DEFAULT_DISPLAY_PREFS);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPrefs(readSaved());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onPointer = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  const update = (patch: Partial<DisplayPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    applyDisplayPrefs(next);
    try {
      localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify(next));
    } catch {
      // Private mode: the choice just won't be remembered.
    }
  };

  const choice = <T extends string>(value: T, current: T, label: string, onPick: (v: T) => void) => (
    <button type="button" className={styles.option} aria-pressed={value === current} onClick={() => onPick(value)}>
      {label}
    </button>
  );

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls="display-menu-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">Aa</span> Display
      </button>
      {open && (
        <div id="display-menu-panel" className={styles.panel} role="group" aria-label="Display options">
          <fieldset className={styles.group}>
            <legend className={styles.legend}>Theme</legend>
            <div className={styles.options}>
              {choice('system', prefs.theme, 'Auto', (theme) => update({ theme }))}
              {choice('light', prefs.theme, 'Light', (theme) => update({ theme }))}
              {choice('dark', prefs.theme, 'Dark', (theme) => update({ theme }))}
            </div>
          </fieldset>
          <fieldset className={styles.group}>
            <legend className={styles.legend}>Text size</legend>
            <div className={styles.options}>
              {choice('normal', prefs.text, 'A', (text) => update({ text }))}
              {choice('large', prefs.text, 'A+', (text) => update({ text }))}
              {choice('xl', prefs.text, 'A++', (text) => update({ text }))}
            </div>
          </fieldset>
          <fieldset className={styles.group}>
            <legend className={styles.legend}>Readability</legend>
            <div className={styles.options}>
              <button
                type="button"
                className={styles.option}
                aria-pressed={prefs.contrast}
                onClick={() => update({ contrast: !prefs.contrast })}
              >
                High contrast
              </button>
              <button
                type="button"
                className={styles.option}
                aria-pressed={prefs.reduceMotion}
                onClick={() => update({ reduceMotion: !prefs.reduceMotion })}
              >
                Reduce motion
              </button>
            </div>
          </fieldset>
          <button
            type="button"
            className={styles.reset}
            onClick={() => update({ ...DEFAULT_DISPLAY_PREFS })}
          >
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}
