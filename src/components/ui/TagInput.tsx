// src/components/ui/TagInput.tsx
'use client';
import { useState, KeyboardEvent } from 'react';
import styles from './TagInput.module.css';

export function TagInput({ label, value, onChange }: { label: string; value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const tag = draft.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className={styles.wrap}>
      <label className={styles.label} htmlFor="tag-input">
        {label}
      </label>
      <div className={styles.field}>
        {value.map((tag) => (
          <span key={tag} className={styles.chip}>
            {tag}
            <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remove ${tag}`}>
              ×
            </button>
          </span>
        ))}
        <input
          id="tag-input"
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={value.length === 0 ? 'e.g. Fades, Beard sculpting' : ''}
        />
      </div>
      <p className={styles.hint}>Press Enter or comma to add.</p>
    </div>
  );
}
