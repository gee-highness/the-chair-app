// src/components/LegalShell.tsx
//
// Shared layout for the platform's static pages (privacy, terms, contact).
import { ReactNode } from 'react';
import { BackLink } from '@/components/BackLink';
import styles from './LegalShell.module.css';

export function LegalShell({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
      <BackLink href="/" label="Home" />
      <h1 className={styles.title}>{title}</h1>
      {updated && <p className={styles.updated}>Last updated {updated}</p>}
      <div className={styles.body}>{children}</div>
    </main>
  );
}
