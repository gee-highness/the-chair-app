// src/components/guide/GuideView.tsx
//
// Renders one or more guides: tabs when there are several, a contents list,
// numbered sections with numbered steps and tips, and an FAQ. Print or save
// as PDF from the browser; the print stylesheet hides the controls.
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LogoMark } from '@/components/Logo';
import type { Guide } from '@/lib/guide/guides';
import styles from './GuideView.module.css';

export function GuideView({ guides, printAll = false }: { guides: Guide[]; printAll?: boolean }) {
  const [index, setIndex] = useState(0);
  const guide = guides[Math.min(index, guides.length - 1)];
  if (!guide) return null;

  return (
    <main className={styles.page} data-testid="guide-page">
      <div className={styles.top}>
        <div>
          <p className={styles.eyebrow}>The Chair App</p>
          <h1 className={styles.title}>{guide.title}</h1>
          <p className={styles.tagline}>{guide.tagline}</p>
        </div>
        <div className={styles.noPrint}>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            Print or save as PDF
          </Button>
        </div>
      </div>

      {guides.length > 1 && (
        <div className={`${styles.tabs} ${styles.noPrint}`} role="tablist" aria-label="Guides">
          {guides.map((g, i) => (
            <Button
              key={g.id}
              role="tab"
              aria-selected={i === index}
              variant={i === index ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setIndex(i)}
            >
              {g.title.replace(' Guide', '')}
            </Button>
          ))}
        </div>
      )}

      <nav className={`${styles.toc} ${styles.noPrint}`} aria-label="Contents">
        <p className={styles.tocTitle}>In this guide</p>
        <ol className={styles.tocList}>
          {guide.sections.map((s) => (
            <li key={s.id}>
              <a href={`#${guide.id}-${s.id}`}>{s.title}</a>
            </li>
          ))}
          <li>
            <a href={`#${guide.id}-faq`}>Questions people ask</a>
          </li>
        </ol>
      </nav>

      {guide.sections.map((s, i) => (
        <section key={s.id} id={`${guide.id}-${s.id}`} className={styles.section} aria-labelledby={`${guide.id}-${s.id}-h`}>
          <h2 id={`${guide.id}-${s.id}-h`} className={styles.sectionTitle}>
            <span className={styles.num} aria-hidden="true">
              {i + 1}
            </span>
            {s.title}
          </h2>
          {s.intro && <p className={styles.intro}>{s.intro}</p>}
          <ol className={styles.steps}>
            {s.steps.map((step, n) => (
              <li key={n}>{step}</li>
            ))}
          </ol>
          {s.tip && (
            <p className={styles.tip}>
              <strong>Tip: </strong>
              {s.tip}
            </p>
          )}
        </section>
      ))}

      <h2 id={`${guide.id}-faq`} className={styles.faqTitle}>
        Questions people ask
      </h2>
      {guide.faq.map(([q, a]) => (
        <details key={q} className={styles.faq} open={printAll || undefined}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
      <p className={styles.noPrint} style={{ marginTop: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--ink-soft)' }}>
        <LogoMark size={28} /> Need more help? Use Contact in the footer.
      </p>
    </main>
  );
}
