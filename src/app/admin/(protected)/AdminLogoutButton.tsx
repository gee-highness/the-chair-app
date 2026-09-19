// src/app/admin/(protected)/AdminLogoutButton.tsx
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import styles from './AdminLogoutButton.module.css';

export function AdminLogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    if ('caches' in window) {
      caches.delete('chair-app-v1-dynamic').catch(() => {});
    }
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout} className={styles.logout}>
      Logout
    </Button>
  );
}
