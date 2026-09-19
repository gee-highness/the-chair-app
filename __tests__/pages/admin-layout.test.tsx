// __tests__/pages/admin-layout.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ cookieValue: undefined as string | undefined, session: null as any }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'session' && mocks.cookieValue ? { value: mocks.cookieValue } : undefined) }),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

vi.mock('@/lib/auth', () => ({
  verifySessionToken: async () => mocks.session,
}));

import AdminProtectedLayout from '@/app/admin/(protected)/layout';

describe('AdminProtectedLayout', () => {
  beforeEach(() => {
    mocks.cookieValue = undefined;
    mocks.session = null;
  });

  it('redirects to /admin/login with no session', async () => {
    await expect(AdminProtectedLayout({ children: <div /> })).rejects.toThrow('REDIRECT:/admin/login');
  });

  it('redirects when the session role is not super_admin (e.g. a tenant admin)', async () => {
    mocks.session = { role: 'admin' };
    await expect(AdminProtectedLayout({ children: <div /> })).rejects.toThrow('REDIRECT:/admin/login');
  });

  it('renders the admin shell with a Logout button for a valid super_admin session', async () => {
    mocks.session = { role: 'super_admin' };
    const jsx = await AdminProtectedLayout({ children: <p>Admin content</p> });
    render(jsx);
    expect(screen.getByText('The Chair App — Admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });
});
