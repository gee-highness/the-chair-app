// __tests__/pages/tenant-layout.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFetch } from '../helpers/fetchMock';

const mocks = vi.hoisted(() => ({ pathname: '/t/demo' }));

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantSlug: 'demo' }),
  usePathname: () => mocks.pathname,
}));

import TenantLayout from '@/app/t/[tenantSlug]/layout';

const originalFetch = global.fetch;
const originalLocation = window.location;

describe('TenantLayout', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    mocks.pathname = '/t/demo';
  });

  it('renders children bare (no header/footer chrome) under /dashboard — DashboardShell provides its own', () => {
    mocks.pathname = '/t/demo/dashboard/settings';
    render(
      <TenantLayout>
        <p>Dashboard child</p>
      </TenantLayout>
    );
    expect(screen.getByText('Dashboard child')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('shows the tenant name once loaded, and a Book + My appointments nav', async () => {
    mockFetch({
      '/api/auth/verify': () => ({ status: 401, json: {} }),
      '/api/public/tenants/demo': () => ({ json: { tenant: { name: 'Demo Salon', branding: {} }, settings: {} } }),
    });
    render(
      <TenantLayout>
        <p>Page content</p>
      </TenantLayout>
    );
    await waitFor(() => expect(screen.getByText('Demo Salon')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /Book/ })).toHaveAttribute('href', '/t/demo/book');
    expect(screen.getByRole('link', { name: 'My appointments' })).toHaveAttribute('href', '/t/demo/appointments');
  });

  it('shows "Staff sign in" for a signed-out visitor', async () => {
    mockFetch({
      '/api/auth/verify': () => ({ status: 401, json: {} }),
      '/api/public/tenants/demo': () => ({ json: { tenant: { name: 'Demo Salon' }, settings: {} } }),
    });
    render(
      <TenantLayout>
        <p>Content</p>
      </TenantLayout>
    );
    await waitFor(() => expect(screen.getByRole('link', { name: 'Staff sign in' })).toBeInTheDocument());
  });

  it('shows "Log out" instead of "Staff sign in" for a staff (subjectType: user) session', async () => {
    mockFetch({
      '/api/auth/verify': () => ({ json: { role: 'admin', subjectType: 'user' } }),
      '/api/public/tenants/demo': () => ({ json: { tenant: { name: 'Demo Salon' }, settings: {} } }),
    });
    render(
      <TenantLayout>
        <p>Content</p>
      </TenantLayout>
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Staff sign in' })).not.toBeInTheDocument();
  });

  it('does NOT show "Log out" for a signed-in CUSTOMER (subjectType: customer) — only staff sessions count', async () => {
    mockFetch({
      '/api/auth/verify': () => ({ json: { role: 'customer', subjectType: 'customer' } }),
      '/api/public/tenants/demo': () => ({ json: { tenant: { name: 'Demo Salon' }, settings: {} } }),
    });
    render(
      <TenantLayout>
        <p>Content</p>
      </TenantLayout>
    );
    await waitFor(() => expect(screen.getByRole('link', { name: 'Staff sign in' })).toBeInTheDocument());
  });
});
