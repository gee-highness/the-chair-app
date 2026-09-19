// src/components/ui/Skeleton.tsx
import styles from './Skeleton.module.css';

export function Skeleton({ width, height = '1em', radius, style }: { width?: string | number; height?: string | number; radius?: string; style?: React.CSSProperties }) {
  return (
    <span
      className={styles.skeleton}
      aria-hidden="true"
      style={{ width, height, borderRadius: radius ?? 'var(--radius-control)', ...style }}
    />
  );
}

export function SkeletonLines({ count = 3 }: { count?: number }) {
  return (
    <div className={styles.stack} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height="0.9em" width={i === count - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}
