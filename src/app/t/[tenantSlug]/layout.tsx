// src/app/t/[tenantSlug]/layout.tsx
//
// Public/customer-facing chrome for a tenant. Two audit fixes folded in
// while rebuilding this for the design system:
//   1. The nav used to show "Logout" and "My Appointments" unconditionally,
//      even to a signed-out visitor, and never linked to staff login at
//      all (both flagged in AUDIT_REPORT.md). Now it branches on whether a
//      staff session exists, and links to /login when it doesn't.
//   2. This layout wraps EVERY /t/[tenantSlug]/** route, including the new
//      /dashboard surface (Next's nested-layout rule) — the dashboard has
//      its own full chrome (DashboardShell), so this component renders
//      children bare (no header/footer) whenever the path is under
//      /dashboard, rather than double-chroming the staff console.
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { tenantThemeStyle } from '@/lib/tenantTheme';
import { Skeleton } from '@/components/ui/Skeleton';
import { ToastProvider } from '@/components/ui/Toast';
import styles from './layout.module.css';

interface VerifyResult {
  role: string;
  subjectType: 'user' | 'customer';
}

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tenantSlug: string }>();
  const pathname = usePathname();
  const tenantSlug = params.tenantSlug;
  const isDashboard = pathname?.includes(`/t/${tenantSlug}/dashboard`);

  const [user, setUser] = useState<VerifyResult | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<{ name: string; branding?: any; logoUrl?: string } | null>(null);

  useEffect(() => {
    if (isDashboard) return; // dashboard has its own auth-gated layout
    const verifySession = async () => {
      try {
        const res = await fetch('/api/auth/verify');
        if (res.ok) setUser(await res.json());
      } catch {
        // not signed in — fine, this is a public surface
      } finally {
        setCheckedAuth(true);
      }
    };
    verifySession();
  }, [isDashboard]);

  useEffect(() => {
    if (!tenantSlug) return;
    fetch(`/api/public/tenants/${tenantSlug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.tenant) {
          setTenantInfo({ name: data.tenant.name, branding: data.tenant.branding, logoUrl: data.settings?.logoUrl });
        }
      })
      .catch(() => {});
  }, [tenantSlug]);

  if (isDashboard) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    if ('caches' in window) {
      caches.delete('chair-app-v1-dynamic').catch(() => {});
    }
    setUser(null);
    window.location.href = `/t/${tenantSlug}`;
  };

  const isStaff = user?.subjectType === 'user';

  return (
    <ToastProvider>
      <div className={styles.shell} style={tenantThemeStyle(tenantInfo?.branding)}>
        <header className={styles.header}>
          <Link href={`/t/${tenantSlug}`} className={styles.brand}>
            {tenantInfo?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenantInfo.logoUrl} alt="" className={styles.logo} />
            ) : (
              <span className={styles.logoFallback} aria-hidden="true">
                {(tenantInfo?.name || '?').charAt(0)}
              </span>
            )}
            <span>{tenantInfo?.name || <Skeleton width="8rem" />}</span>
          </Link>
          <nav className={styles.nav} aria-label="Main">
            <Link href={`/t/${tenantSlug}/book`} className={styles.navLink}>
              Book
            </Link>
            <Link href={`/t/${tenantSlug}/appointments`} className={styles.navLink}>
              My appointments
            </Link>
            {!checkedAuth ? null : isStaff ? (
              <button onClick={handleLogout} className={styles.navButton}>
                Log out
              </button>
            ) : (
              <Link href={`/t/${tenantSlug}/login`} className={styles.navButtonLink}>
                Staff sign in
              </Link>
            )}
          </nav>
        </header>

        <main className={styles.main}>{children}</main>

        <footer className={styles.footer}>
          <p>&copy; {new Date().getFullYear()} {tenantInfo?.name || 'The Chair App'}</p>
          <Link href="/" className={styles.footerLink}>
            Powered by The Chair App
          </Link>
        </footer>
      </div>
    </ToastProvider>
  );
}
