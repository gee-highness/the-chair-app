// __tests__/pages/admin-layout.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ObjectId } from 'mongodb';
import { FakeDb } from '../helpers/fakeMongo';

const mocks = vi.hoisted(() => ({ cookieValue: undefined as string | undefined, session: null as any, db: null as any }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'session' && mocks.cookieValue ? { value: mocks.cookieValue } : undefined) }),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => '/admin',
}));

vi.mock('@/lib/mongodb', () => ({
  getDatabase: async () => mocks.db,
  connectToDatabase: async () => ({ db: mocks.db, client: {} }),
}));

vi.mock('@/lib/auth', () => ({
  verifySessionToken: async () => mocks.session,
}));

import AdminProtectedLayout from '@/app/admin/(protected)/layout';

describe('AdminProtectedLayout', () => {
  beforeEach(() => {
    mocks.cookieValue = undefined;
    mocks.session = null;
    mocks.db = new FakeDb();
  });

  it('redirects to /admin/login with no session', async () => {
    await expect(AdminProtectedLayout({ children: <div /> })).rejects.toThrow('REDIRECT:/admin/login');
  });

  it('redirects when the session role is not super_admin (e.g. a tenant admin)', async () => {
    mocks.session = { role: 'admin' };
    await expect(AdminProtectedLayout({ children: <div /> })).rejects.toThrow('REDIRECT:/admin/login');
  });

  it('renders the admin shell with the admin name and a Log out button for a valid super_admin session', async () => {
    const adminId = new ObjectId();
    (mocks.db as FakeDb).collection('users').seed([{ _id: adminId, username: 'root', email: 'root@example.com' }]);
    mocks.session = { role: 'super_admin', subjectId: adminId };
    const jsx = await AdminProtectedLayout({ children: <p>Admin content</p> });
    render(jsx);
    expect(screen.getByText('root')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log out/ })).toBeInTheDocument();
    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });
});
