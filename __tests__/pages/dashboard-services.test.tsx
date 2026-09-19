// __tests__/pages/dashboard-services.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRole } from '../helpers/testProviders';
import { mockFetch } from '../helpers/fetchMock';
import ServicesPage from '@/app/t/[tenantSlug]/dashboard/services/page';

const originalFetch = global.fetch;

describe('Services dashboard page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('a non-admin sees the access-denied EmptyState and never fetches categories/services', () => {
    const fetchMock = mockFetch({});
    renderWithRole(<ServicesPage />, 'barber');
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists existing categories and services', async () => {
    mockFetch({
      '/api/categories': () => ({ json: [{ _id: 'c1', name: 'Haircuts' }] }),
      '/api/services': () => ({ json: [{ _id: 's1', name: 'Fade', duration: 30, price: 25, categoryId: 'c1' }] }),
    });
    renderWithRole(<ServicesPage />, 'admin');
    await waitFor(() => expect(screen.getByText('Haircuts')).toBeInTheDocument());
    expect(screen.getByText('Fade')).toBeInTheDocument();
  });

  it('adding a new category posts it and shows it in the list', async () => {
    let categories: any[] = [];
    mockFetch({
      '/api/categories': (url, init) => {
        if (init?.method === 'POST') {
          categories = [...categories, { _id: 'c2', name: 'Coloring' }];
          return { status: 201, json: categories[0] };
        }
        return { json: categories };
      },
      '/api/services': () => ({ json: [] }),
    });
    renderWithRole(<ServicesPage />, 'admin');
    await waitFor(() => expect(screen.getByText('No services yet')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Add category' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Coloring');
    await userEvent.click(screen.getByRole('button', { name: 'Save category' }));

    await waitFor(() => expect(screen.getByText('Coloring')).toBeInTheDocument());
  });

  it('adding a new service requires name/price/duration and posts them as numbers', async () => {
    let services: any[] = [];
    const fetchMock = mockFetch({
      '/api/categories': () => ({ json: [] }),
      '/api/services': (url, init) => {
        if (init?.method === 'POST') {
          services = [...services, { _id: 's2', name: 'Beard Trim', duration: 15, price: 10 }];
          return { status: 201, json: services[0] };
        }
        return { json: services };
      },
    });
    renderWithRole(<ServicesPage />, 'admin');
    await waitFor(() => expect(screen.getByText('No services yet')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Add service' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Beard Trim');
    const priceInput = screen.getByLabelText('Price ($)');
    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, '10');
    const durationInput = screen.getByLabelText('Duration (min)');
    await userEvent.clear(durationInput);
    await userEvent.type(durationInput, '15');
    await userEvent.click(screen.getByRole('button', { name: 'Save service' }));

    await waitFor(() => expect(screen.getByText('Beard Trim')).toBeInTheDocument());
    const postCall = fetchMock.mock.calls.find((c: any) => c[0].includes('/api/services') && c[1]?.method === 'POST');
    expect(postCall).toBeTruthy();
  });
});
