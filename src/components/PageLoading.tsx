// src/components/PageLoading.tsx
//
// Route-level loading state (used by loading.tsx files): a heading, a row of
// stat cards and a few lines, so navigation shows page-shaped placeholders
// instead of a blank screen.
import { Skeleton, SkeletonLines } from '@/components/ui/Skeleton';
import styles from './PageLoading.module.css';

export function PageLoading({ cards = 3 }: { cards?: number }) {
  return (
    <div className={styles.wrap} role="status" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading…</span>
      <Skeleton width="40%" height="2rem" />
      <div className={styles.cards}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className={styles.card}>
            <Skeleton width="50%" height="1.75rem" />
            <div style={{ marginTop: 'var(--space-3)' }}>
              <SkeletonLines count={2} />
            </div>
          </div>
        ))}
      </div>
      <SkeletonLines count={5} />
    </div>
  );
}
