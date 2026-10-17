import type { Metadata } from 'next';
import Link from 'next/link';
import { GUIDES } from '@/lib/guide/guides';
import { LegalShell } from '@/components/LegalShell';
import { SITE_NAME } from '@/lib/site';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: `User guides · ${SITE_NAME}`,
  description: 'Step-by-step guides for customers, salon owners, receptionists, barbers and platform admins.',
};

export default function GuideIndex() {
  return (
    <LegalShell title="User guides">
      <p>Pick the guide that fits you. Each one can be printed or saved as a PDF.</p>
      <ul className={styles.list}>
        {GUIDES.map((g) => (
          <li key={g.id}>
            <Link href={`/guide/${g.id}`} className={styles.card}>
              <strong>{g.title}</strong>
              <span>{g.tagline}</span>
            </Link>
          </li>
        ))}
      </ul>
    </LegalShell>
  );
}
