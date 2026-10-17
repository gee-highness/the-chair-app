// src/components/ui/Confirm.tsx
//
// Replaces window.confirm(): same call shape (await, then act on a boolean)
// but styled to match the app, keyboard-trapped by Modal, and usable inside
// installed PWAs where native dialogs are suppressed or look foreign.
'use client';
import { ReactNode, createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import styles from './Confirm.module.css';

export interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. Defaults to true. */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    // A second request while one is open cancels the first rather than leaking it.
    resolver.current?.(false);
    setOptions(typeof opts === 'string' ? { message: opts } : opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={options !== null} onClose={() => settle(false)} title={options?.title || 'Are you sure?'}>
        <p className={styles.message}>{options?.message}</p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => settle(false)}>
            {options?.cancelLabel || 'Cancel'}
          </Button>
          <Button variant={options?.danger === false ? 'primary' : 'danger'} onClick={() => settle(true)}>
            {options?.confirmLabel || 'Confirm'}
          </Button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

// Outside a provider (isolated renders, tests) this falls back to the
// browser's own confirm so a destructive action is never silently allowed.
const nativeConfirm: ConfirmFn = async (opts) =>
  window.confirm(typeof opts === 'string' ? opts : String(opts.message));

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext) ?? nativeConfirm;
}
