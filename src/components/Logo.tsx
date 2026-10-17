// src/components/Logo.tsx
//
// The Chair App mark (a barber's chair, copper on midnight) as inline SVG so
// it scales crisply and needs no request. The drawing lives in
// scripts/brand/chair.svg; `npm run brand:build` regenerates logoMarkSvg.ts
// and every icon from it. `wordmark` adds the name beside it.
import { LOGO_MARK_SVG } from './logoMarkSvg';
import styles from './Logo.module.css';

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: LOGO_MARK_SVG }}
    />
  );
}

export function Logo({ size = 32, subtitle }: { size?: number; subtitle?: string }) {
  return (
    <span className={styles.logo}>
      <LogoMark size={size} />
      <span className={styles.text}>
        <span className={styles.name}>The Chair App</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
    </span>
  );
}
