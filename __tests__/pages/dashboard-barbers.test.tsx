// __tests__/pages/dashboard-barbers.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRole } from '../helpers/testProviders';
import { mockFetch } from '../helpers/fetchMock';
import BarbersPage from '@/app/t/[tenantSlug]/dashboard/barbers/page';

const originalFetch = global.fetch;
const originalConfirm = window.confirm;

describe('Barbers dashboard page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    window.confirm = originalConfirm;
  });

  it('a non-admin sees the access-denied EmptyState and never fetches barbers', () => {
    const fetchMock = mockFetch({});
    renderWithRole(<BarbersPage />, 'receptionist');
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an empty state with no barbers yet', async () => {
    mockFetch({ '/api/barbers': () => ({ json: [] }) });
    renderWithRole(<BarbersPage />, 'admin');
    await waitFor(() => expect(screen.getByText('No barbers yet')).toBeInTheDocument());
  });

  it('lists existing barbers', async () => {
    mockFetch({ '/api/barbers': () => ({ json: [{ _id: '1', name: 'Alex', slug: 'alex', dailyAvailability: [] }] }) });
    renderWithRole(<BarbersPage />, 'admin');
    await waitFor(() => expect(screen.getByText('Alex')).toBeInTheDocument());
  });

  it('opening "Add barber" and saving posts the new barber and refreshes the list', async () => {
    let barbers: any[] = [];
    const fetchMock = mockFetch({
      '/api/barbers': (url, init) => {
        if (init?.method === 'POST') {
          barbers = [...barbers, { _id: '2', name: 'New Barber', slug: 'new-barber', dailyAvailability: [] }];
          return { status: 201, json: barbers[barbers.length - 1] };
        }
        return { json: barbers };
      },
    });
    renderWithRole(<BarbersPage />, 'admin');
    await waitFor(() => expect(screen.getByText('No barbers yet')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Add barber' }));
    await userEvent.type(screen.getByLabelText('Name'), 'New Barber');
    await userEvent.click(screen.getByRole('button', { name: 'Save barber' }));

    await waitFor(() => expect(screen.getByText('New Barber')).toBeInTheDocument());
    const postCall = fetchMock.mock.calls.find((c: any) => c[1]?.method === 'POST');
    expect(JSON.parse(postCall![1].body).slug).toBe('new-barber'); // auto-slugified from the name
  });

  it('removing a barber asks for confirmation and, once confirmed, calls DELETE', async () => {
    window.confirm = vi.fn(() => true);
    const fetchMock = mockFetch({
      '/api/barbers': (url, init) => {
        if (init?.method === 'DELETE') return { json: { message: 'Deleted' } };
        return { json: [{ _id: '1', name: 'Alex', slug: 'alex', dailyAvailability: [] }] };
      },
    });
    renderWithRole(<BarbersPage />, 'admin');
    await waitFor(() => expect(screen.getByText('Alex')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(window.confirm).toHaveBeenCalledWith('Remove Alex from your barbers?');
    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find((c: any) => c[1]?.method === 'DELETE');
      expect(deleteCall).toBeTruthy();
    });
  });

  it('declining the confirmation does not call DELETE', async () => {
    window.confirm = vi.fn(() => false);
    const fetchMock = mockFetch({
      '/api/barbers': () => ({ json: [{ _id: '1', name: 'Alex', slug: 'alex', dailyAvailability: [] }] }),
    });
    renderWithRole(<BarbersPage />, 'admin');
    await waitFor(() => expect(screen.getByText('Alex')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    const deleteCall = fetchMock.mock.calls.find((c: any) => c[1]?.method === 'DELETE');
    expect(deleteCall).toBeUndefined();
  });
});
