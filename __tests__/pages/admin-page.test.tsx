// __tests__/pages/admin-page.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithToast } from '../helpers/testProviders';
import { mockFetch, bodyOf } from '../helpers/fetchMock';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import { AdminLogoutButton } from '@/app/admin/(protected)/AdminLogoutButton';
import TenantsPage from '@/app/admin/(protected)/tenants/page';

// The tenants list API is paginated: { tenants, total, page, pageSize, pageCount }.
const listOf = (tenants: any[]) => ({ tenants, total: tenants.length, page: 1, pageSize: 20, pageCount: 1 });

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

describe('Admin tenants page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lists existing tenants with their status badge', async () => {
    mockFetch({
      '/api/platform/tenants': () => ({ json: listOf([{ _id: 't1', name: 'Demo Salon', slug: 'demo', status: 'active', contactEmail: 'x@demo.test' }]) }),
    });
    renderWithToast(<TenantsPage />);
    await waitFor(() => expect(screen.getByText('Demo Salon')).toBeInTheDocument());
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('shows an empty state with no tenants yet', async () => {
    mockFetch({ '/api/platform/tenants': () => ({ json: listOf([]) }) });
    renderWithToast(<TenantsPage />);
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
        return { json: listOf(tenants) };
      },
    });
    renderWithToast(<TenantsPage />);
    await waitFor(() => expect(screen.getByText('No tenants yet')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'New tenant' }));
    await userEvent.type(screen.getByLabelText('Slug'), 'new-salon');
    await userEvent.type(screen.getByLabelText('Salon name'), 'New Salon');
    await userEvent.type(screen.getByLabelText('Contact email'), 'c@new.test');
    await userEvent.type(screen.getByLabelText('First admin email'), 'admin@new.test');
    await userEvent.type(screen.getByLabelText('First admin password'), 'StrongPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'Create tenant' }));

    await waitFor(() => expect(screen.getAllByText('New Salon').length).toBeGreaterThan(0));
    const postCall = fetchMock.mock.calls.find((c: any) => c[1]?.method === 'POST');
    expect(bodyOf(postCall!).slug).toBe('new-salon');
    // The create form closes after a successful create.
    expect(screen.queryByLabelText('Slug')).not.toBeInTheDocument();
  });

  it('offers the owner welcome PDF for download after a salon is created', async () => {
    mockFetch({
      '/api/platform/tenants': (url, init) =>
        init?.method === 'POST'
          ? { status: 201, json: { _id: 't3', name: 'Quano Locs', slug: 'quano-locs', adminEmail: 'quano-locs@chair.app', welcomePdf: 'JVBERi0xLjQK' } }
          : { json: listOf([]) },
    });
    renderWithToast(<TenantsPage />);
    await waitFor(() => expect(screen.getByText('No tenants yet')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'New tenant' }));
    await userEvent.type(screen.getByLabelText('Slug'), 'quano-locs');
    await userEvent.type(screen.getByLabelText('Salon name'), 'Quano Locs');
    await userEvent.type(screen.getByLabelText('Contact email'), 'q@x.test');
    await userEvent.type(screen.getByLabelText('First admin email'), 'quano-locs@chair.app');
    await userEvent.type(screen.getByLabelText('First admin password'), 'Quano-P@ss');
    await userEvent.click(screen.getByRole('button', { name: 'Create tenant' }));

    expect(await screen.findByRole('button', { name: 'Download welcome PDF' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Tenant ready' })).toHaveTextContent('quano-locs@chair.app');
  });

  it('says so when the salon was created but the PDF could not be generated', async () => {
    mockFetch({
      '/api/platform/tenants': (url, init) =>
        init?.method === 'POST' ? { status: 201, json: { _id: 't4', name: 'No Pdf', slug: 'no-pdf', welcomePdf: null } } : { json: listOf([]) },
    });
    renderWithToast(<TenantsPage />);
    await waitFor(() => expect(screen.getByText('No tenants yet')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'New tenant' }));
    await userEvent.type(screen.getByLabelText('Slug'), 'no-pdf');
    await userEvent.type(screen.getByLabelText('Salon name'), 'No Pdf');
    await userEvent.type(screen.getByLabelText('Contact email'), 'q@x.test');
    await userEvent.type(screen.getByLabelText('First admin email'), 'o@x.test');
    await userEvent.type(screen.getByLabelText('First admin password'), 'Strong-Pass-1');
    await userEvent.click(screen.getByRole('button', { name: 'Create tenant' }));
    expect(await screen.findByText(/could not be generated/i)).toBeInTheDocument();
  });

  it('shows an error toast when tenant creation fails', async () => {
    mockFetch({
      '/api/platform/tenants': (url, init) => {
        if (init?.method === 'POST') return { status: 409, json: { message: 'Tenant slug already exists' } };
        return { json: listOf([]) };
      },
    });
    renderWithToast(<TenantsPage />);
    await waitFor(() => expect(screen.getByText('No tenants yet')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'New tenant' }));
    await userEvent.type(screen.getByLabelText('Slug'), 'taken');
    await userEvent.type(screen.getByLabelText('Salon name'), 'Taken');
    await userEvent.type(screen.getByLabelText('Contact email'), 'c@taken.test');
    await userEvent.type(screen.getByLabelText('First admin email'), 'admin@taken.test');
    await userEvent.type(screen.getByLabelText('First admin password'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Create tenant' }));

    await waitFor(() => expect(screen.getByText('Tenant slug already exists')).toBeInTheDocument());
  });
});
