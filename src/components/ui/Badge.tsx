// src/components/ui/Badge.tsx
import { ReactNode } from 'react';
import styles from './Badge.module.css';

type Tone = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'waitlist' | 'neutral' | 'brand';

const TONE_LABEL: Record<Tone, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  waitlist: 'Waitlist',
  neutral: '',
  brand: '',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children?: ReactNode }) {
  return <span className={[styles.badge, styles[tone]].join(' ')}>{children ?? TONE_LABEL[tone]}</span>;
}

export function statusTone(status: string): Tone {
  if (status === 'pending' || status === 'confirmed' || status === 'completed' || status === 'cancelled' || status === 'waitlist') return status;
  return 'neutral';
}
