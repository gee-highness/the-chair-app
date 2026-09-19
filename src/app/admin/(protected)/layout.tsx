// src/app/admin/(protected)/layout.tsx
//
// Server-side gate for the platform-admin surface. Route-group parentheses
// keep this out of the URL, so /admin/login (outside this group) stays
// reachable without a session while everything else under /admin requires
// a super_admin session, checked here before any child renders.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken } from '@/lib/auth';
import { AdminLogoutButton } from './AdminLogoutButton';
import { ToastProvider } from '@/components/ui/Toast';
import styles from './layout.module.css';

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  const session = await verifySessionToken(token);

  if (!session || session.role !== 'super_admin') {
    redirect('/admin/login');
  }

  return (
    <ToastProvider>
      <div className={styles.shell}>
        <header className={styles.header}>
          <span className={styles.brand}>The Chair App — Admin</span>
          <AdminLogoutButton />
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </ToastProvider>
  );
}
