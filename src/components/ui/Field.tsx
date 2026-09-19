// src/components/ui/Field.tsx
import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode, useId } from 'react';
import styles from './Field.module.css';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

function FieldShell({ label, hint, error, required, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && <span className={styles.required} aria-hidden="true"> *</span>}
      </label>
      {children(id, describedBy)}
      {hint && !error && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function Input({ label, hint, error, required, className, ...rest }: InputProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {(id, describedBy) => (
        <input
          id={id}
          className={[styles.control, error ? styles.controlError : '', className || ''].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function Textarea({ label, hint, error, required, className, ...rest }: TextareaProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {(id, describedBy) => (
        <textarea
          id={id}
          className={[styles.control, styles.textarea, error ? styles.controlError : '', className || '']
            .filter(Boolean)
            .join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Select({ label, hint, error, required, className, children, ...rest }: SelectProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {(id, describedBy) => (
        <select
          id={id}
          className={[styles.control, styles.select, error ? styles.controlError : '', className || '']
            .filter(Boolean)
            .join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          {...rest}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}
