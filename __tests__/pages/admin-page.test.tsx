// __tests__/pages/admin-page.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithToast } from '../helpers/testProviders';
import { mockFetch } from '../helpers/fetchMock';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import { AdminLogoutButton } from '@/app/admin/(protected)/AdminLogoutButton';
import AdminHome from '@/app/admin/(protected)/page';

const originalFetch = global.fetch;

describe('AdminLogoutButton', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    router.push.mockClear();
  });

  it('logs out and redirects to /admin/login', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as any;
    render(<AdminLogoutButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin/login'));
  });
});

describe('Admin tenant-management page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lists existing tenants with their status badge', async () => {
    mockFetch({
      '/api/platform/tenants': () => ({ json: [{ _id: 't1', name: 'Demo Salon', slug: 'demo', status: 'active', contactEmail: 'x@demo.test' }] }),
    });
    renderWithToast(<AdminHome />);
    await waitFor(() => expect(screen.getByText('Demo Salon')).toBeInTheDocument());
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('shows an empty state with no tenants yet', async () => {
    mockFetch({ '/api/platform/tenants': () => ({ json: [] }) });
    renderWithToast(<AdminHome />);
    await waitFor(() => expect(screen.getByText('No tenants yet')).toBeInTheDocument());
  });

  it('creating a tenant posts the form and clears it, then reloads the list', async () => {
    let tenants: any[] = [];
    const fetchMock = mockFetch({
      '/api/platform/tenants': (url, init) => {
        if (init?.method === 'POST') {
          tenants = [{ _id: 't2', name: 'New Salon', slug: 'new-salon', status: 'active', contactEmail: 'c@new.test' }];
          return { status: 201, json: tenants[0] };
        }
        return { json: tenants };
      },
    });
    renderWithToast(<AdminHome />);
    await waitFor(() => expect(screen.getByText('No tenants yet')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Slug'), 'new-salon');
    await userEvent.type(screen.getByLabelText('Salon name'), 'New Salon');
    await userEvent.type(screen.getByLabelText('Contact email'), 'c@new.test');
    await userEvent.type(screen.getByLabelText('First admin email'), 'admin@new.test');
    await userEvent.type(screen.getByLabelText('First admin password'), 'StrongPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'Create tenant' }));

    await waitFor(() => expect(screen.getByText('New Salon')).toBeInTheDocument());
    const postCall = fetchMock.mock.calls.find((c: any) => c[1]?.method === 'POST');
    expect(JSON.parse(postCall![1].body).slug).toBe('new-salon');
    // Form resets after a successful create.
    expect(screen.getByLabelText('Slug')).toHaveValue('');
  });

  it('shows an error toast when tenant creation fails', async () => {
    mockFetch({
      '/api/platform/tenants': (url, init) => {
        if (init?.method === 'POST') return { status: 409, json: { message: 'Tenant slug already exists' } };
        return { json: [] };
      },
    });
    renderWithToast(<AdminHome />);
    await waitFor(() => expect(screen.getByText('No tenants yet')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Slug'), 'taken');
    await userEvent.type(screen.getByLabelText('Salon name'), 'Taken');
    await userEvent.type(screen.getByLabelText('Contact email'), 'c@taken.test');
    await userEvent.type(screen.getByLabelText('First admin email'), 'admin@taken.test');
    await userEvent.type(screen.getByLabelText('First admin password'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Create tenant' }));

    await waitFor(() => expect(screen.getByText('Tenant slug already exists')).toBeInTheDocument());
  });
});
