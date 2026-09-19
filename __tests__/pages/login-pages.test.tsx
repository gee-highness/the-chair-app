// __tests__/pages/login-pages.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFetch } from '../helpers/fetchMock';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useParams: () => ({ tenantSlug: 'demo' }),
}));

import TenantLoginPage from '@/app/t/[tenantSlug]/login/page';
import AdminLoginPage from '@/app/admin/login/page';

const originalFetch = global.fetch;

describe('Tenant staff login page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    router.push.mockClear();
    router.refresh.mockClear();
  });

  it('renders email/password fields and no hardcoded inline colors (design-system rebuild)', () => {
    render(<TenantLoginPage />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('a successful login posts to /api/auth/login WITH the tenantSlug, then redirects to the dashboard', async () => {
    const fetchMock = mockFetch({ '/api/auth/login': () => ({ json: { message: 'ok' } }) });
    render(<TenantLoginPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'admin@demo.test');
    await userEvent.type(screen.getByLabelText('Password'), 'pw123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/t/demo/dashboard'));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ email: 'admin@demo.test', password: 'pw123', tenantSlug: 'demo' });
  });

  it('a failed login shows the error message and does not redirect', async () => {
    mockFetch({ '/api/auth/login': () => ({ status: 401, json: { message: 'Invalid email or password' } }) });
    render(<TenantLoginPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'wrong@demo.test');
    await userEvent.type(screen.getByLabelText('Password'), 'bad');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password'));
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('Admin (platform) login page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    router.push.mockClear();
    router.refresh.mockClear();
  });

  it('posts to /api/auth/login WITHOUT a tenantSlug (platform-wide login)', async () => {
    const fetchMock = mockFetch({ '/api/auth/login': () => ({ json: { message: 'ok' } }) });
    render(<AdminLoginPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'super@chairapp.test');
    await userEvent.type(screen.getByLabelText('Password'), 'pw123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin'));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ email: 'super@chairapp.test', password: 'pw123' });
  });

  it('a failed login shows the error message', async () => {
    mockFetch({ '/api/auth/login': () => ({ status: 401, json: { message: 'Invalid email or password' } }) });
    render(<AdminLoginPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'wrong@chairapp.test');
    await userEvent.type(screen.getByLabelText('Password'), 'bad');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password'));
  });
});
