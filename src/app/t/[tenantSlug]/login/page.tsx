// src/app/t/[tenantSlug]/login/page.tsx
//
// Rebuilt for the Priority 4 design-system migration (FIX_PLAN.md) — this
// screen was the last one in the app still using raw inline styles and
// hardcoded light-only colors. Now uses Ticket/Input/Button and theme
// tokens, matching admin/(protected)/page.tsx's create-tenant form as the
// closest existing "form on its own page" reference.
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Ticket } from '@/components/ui/Ticket';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';

export default function TenantLoginPage() {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params.tenantSlug;
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, tenantSlug }),
      });

      if (res.ok) {
        router.push(`/t/${tenantSlug}/dashboard`);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.message || 'Login failed');
      }
    } catch {
      setError('Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <Ticket className={styles.ticket}>
        <p className={styles.eyebrow}>Staff</p>
        <h1 className={styles.heading}>Sign in</h1>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit} className={styles.form}>
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          <Button type="submit" loading={submitting} fullWidth>
            Log in
          </Button>
        </form>
      </Ticket>
    </div>
  );
}
