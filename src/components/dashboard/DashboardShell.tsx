// src/components/dashboard/DashboardShell.tsx
//
// Nav-audit follow-up: the sidebar used to be an off-canvas panel on mobile
// (hidden by default, slid in over an overlay via a hamburger toggle) —
// requested change is a persistent icon-only rail instead, staying on the
// side at every width rather than hiding behind a button. That removes the
// need for open/close state, an overlay, Escape handling, and a scroll
// lock entirely — the rail is always part of the layout, just narrower and
// unlabeled below the desktop breakpoint (see DashboardShell.module.css).
'use client';
import { ReactElement, ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { RoleProvider } from '@/hooks/useRole';
import { CurrencyProvider } from '@/hooks/useCurrency';
import { usePendingCount } from '@/hooks/usePendingCount';
import { useBookingIssueCount } from '@/hooks/useBookingIssueCount';
import { MobileMoreSheet } from '@/components/MobileMoreSheet';
import { dynamicCacheNameForPathname } from '@/lib/pwaScope';
import {
  OverviewIcon,
  AppointmentsIcon,
  PostsIcon,
  WaitlistIcon,
  BookingIssuesIcon,
  ServicesIcon,
  BarbersIcon,
  StaffIcon,
  CustomersIcon,
  ReviewsIcon,
  AnalyticsIcon,
  SettingsIcon,
  AccountIcon,
  GuideIcon,
  PublicPageIcon,
  LogoutIcon,
  MoreIcon,
} from './NavIcons';
import { LogoMark } from '@/components/Logo';
import { PageHint } from './PageHint';
import styles from './DashboardShell.module.css';

interface NavItem {
  href: string;
  label: string;
  icon: (props: { className?: string }) => ReactElement;
  roles: Array<'admin' | 'receptionist' | 'barber'>;
  // Shown as a tab in the phone's bottom bar; everything else lives under More.
  phoneTab?: boolean;
  // Shorter visible label for the phone tab bar; the full label stays as the accessible name.
  shortLabel?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '', label: 'Overview', icon: OverviewIcon, roles: ['admin', 'receptionist', 'barber'], phoneTab: true },
  { href: '/appointments', label: 'Appointments', icon: AppointmentsIcon, roles: ['admin', 'receptionist', 'barber'], phoneTab: true },
  { href: '/booking-issues', label: 'Booking issues', icon: BookingIssuesIcon, roles: ['admin', 'receptionist', 'barber'], phoneTab: true, shortLabel: 'Issues' },
  { href: '/posts', label: 'Posts', icon: PostsIcon, roles: ['admin', 'barber'] },
  { href: '/waitlist', label: 'Waitlist', icon: WaitlistIcon, roles: ['admin', 'receptionist'] },
  { href: '/services', label: 'Services', icon: ServicesIcon, roles: ['admin'] },
  { href: '/barbers', label: 'Barbers', icon: BarbersIcon, roles: ['admin'] },
  { href: '/staff', label: 'Staff', icon: StaffIcon, roles: ['admin'] },
  { href: '/customers', label: 'Customers', icon: CustomersIcon, roles: ['admin', 'receptionist'] },
  { href: '/reviews', label: 'Reviews', icon: ReviewsIcon, roles: ['admin'] },
  { href: '/analytics', label: 'Analytics', icon: AnalyticsIcon, roles: ['admin'] },
  { href: '/settings', label: 'Settings', icon: SettingsIcon, roles: ['admin'] },
  { href: '/guide', label: 'Guide', icon: GuideIcon, roles: ['admin', 'receptionist', 'barber'] },
  { href: '/account', label: 'Account', icon: AccountIcon, roles: ['admin', 'receptionist', 'barber'] },
];

export function DashboardShell({
  tenantSlug,
  tenantName,
  role,
  currency,
  children,
}: {
  tenantSlug: string;
  tenantName: string;
  role: 'admin' | 'receptionist' | 'barber';
  currency: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/t/${tenantSlug}/dashboard`;

  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const pending = usePendingCount();
  const issues = useBookingIssueCount();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [pathname]);

  // "(3) Salon" in the browser tab while bookings wait for confirmation.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = pending > 0 ? `(${pending}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [pending]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    if ('caches' in window) {
      caches.delete(dynamicCacheNameForPathname(window.location.pathname)).catch(() => {});
    }
    router.push(`/t/${tenantSlug}/login`);
    router.refresh();
  };

  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar} aria-label="Dashboard navigation">
        <div className={styles.brand}>
          <LogoMark size={36} />
          <div className={styles.brandText}>
            <p className={styles.brandName}>{tenantName}</p>
            <p className={styles.brandRole}>{role}</p>
          </div>
        </div>
        <ul className={styles.navList}>
          {items.map((item) => {
            const href = `${base}${item.href}`;
            const active = pathname === href || (item.href === '' && pathname === base);
            const Icon = item.icon;
            return (
              <li key={item.href} className={item.phoneTab ? undefined : styles.hideOnPhone}>
                <Link
                  href={href}
                  className={[styles.navLink, active ? styles.navLinkActive : ''].join(' ')}
                  aria-current={active ? 'page' : undefined}
                  title={item.label}
                  aria-label={item.shortLabel ? item.label : undefined}
                >
                  <span className={styles.iconWrap}>
                    <Icon className={styles.navIcon} />
                    {item.href === '/appointments' && pending > 0 && (
                      <span className={styles.badge} aria-label={`${pending} bookings waiting for confirmation`}>
                        {pending > 9 ? '9+' : pending}
                      </span>
                    )}
                    {item.href === '/booking-issues' && issues > 0 && (
                      <span className={styles.badge} aria-label={`${issues} blocked bookings need attention`}>
                        {issues > 9 ? '9+' : issues}
                      </span>
                    )}
                  </span>
                  <span className={styles.navLabel}>{item.shortLabel || item.label}</span>
                </Link>
              </li>
            );
          })}
          <li className={styles.moreItem}>
            <button
              type="button"
              className={[styles.navLink, moreOpen ? styles.navLinkActive : ''].join(' ')}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((o) => !o)}
            >
              <span className={styles.iconWrap}>
                <MoreIcon className={styles.navIcon} />
              </span>
              <span className={styles.navLabel}>More</span>
            </button>
          </li>
        </ul>
        <div className={styles.sidebarFooter}>
          <Link href={`/t/${tenantSlug}`} className={styles.navLink} title="View public page">
            <PublicPageIcon className={styles.navIcon} />
            <span className={styles.navLabel}>Public</span>
          </Link>
          <button className={[styles.navLink, styles.logout].join(' ')} onClick={handleLogout} title="Log out">
            <LogoutIcon className={styles.navIcon} />
            <span className={styles.navLabel}>Log out</span>
          </button>
        </div>
      </nav>

      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} label="More pages">
        {items
          .filter((item) => !item.phoneTab)
          .map((item) => {
            const href = `${base}${item.href}`;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={href} aria-current={pathname === href ? 'page' : undefined}>
                <Icon />
                {item.label}
              </Link>
            );
          })}
        <Link href={`/t/${tenantSlug}`}>
          <PublicPageIcon />
          Public page
        </Link>
        <button type="button" onClick={handleLogout}>
          <LogoutIcon />
          Log out
        </button>
      </MobileMoreSheet>

      <main id="main-content" tabIndex={-1} className={styles.main}>
        <RoleProvider value={role}>
          <CurrencyProvider value={currency}>
            <PageHint section={pathname === base ? '' : (pathname || '').slice(base.length + 1).split('/')[0]} base={base} />
            {children}
          </CurrencyProvider>
        </RoleProvider>
      </main>
    </div>
  );
}
