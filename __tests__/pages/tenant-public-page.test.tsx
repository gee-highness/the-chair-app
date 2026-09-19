// __tests__/pages/tenant-public-page.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFetch } from '../helpers/fetchMock';

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantSlug: 'demo' }),
}));

vi.mock('@/components/SalonMapView', () => ({
  default: () => <div data-testid="mock-salon-map" />,
}));

import TenantHome from '@/app/t/[tenantSlug]/page';

const originalFetch = global.fetch;

const baseData = {
  tenant: { _id: 't1', name: 'Demo Salon', branding: {} },
  settings: { title: 'Demo Salon', description: 'A great place', phone: '555-0100' },
  barbers: [],
  services: [],
  categories: [],
  reviews: [],
  averageRating: null,
};

describe('Tenant public page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shows the hero title/description and a Book link', async () => {
    mockFetch({
      '/api/public/tenants/demo': () => ({ json: baseData }),
      '/api/customer-auth/me': () => ({ status: 401, json: {} }),
    });
    render(<TenantHome />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Demo Salon' })).toBeInTheDocument());
    expect(screen.getByText('A great place')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Book an appointment' })).toHaveAttribute('href', '/t/demo/book');
  });

  it('shows the empty state when there are no barbers or categories yet', async () => {
    mockFetch({
      '/api/public/tenants/demo': () => ({ json: baseData }),
      '/api/customer-auth/me': () => ({ status: 401, json: {} }),
    });
    render(<TenantHome />);
    await waitFor(() => expect(screen.getByText('This salon is still setting up')).toBeInTheDocument());
  });

  it('lists barbers, each linking to their own profile page', async () => {
    mockFetch({
      '/api/public/tenants/demo': () => ({
        json: { ...baseData, barbers: [{ _id: 'b1', name: 'Alex', slug: 'alex', tags: ['Fades'] }] },
      }),
      '/api/customer-auth/me': () => ({ status: 401, json: {} }),
    });
    render(<TenantHome />);
    await waitFor(() => expect(screen.getByRole('link', { name: /Alex/ })).toHaveAttribute('href', '/t/demo/barbers/alex'));
  });

  it('shows the average rating and review count when reviews exist', async () => {
    mockFetch({
      '/api/public/tenants/demo': () => ({
        json: { ...baseData, reviews: [{ _id: 'r1', rating: 5, text: 'Great!', createdAt: new Date().toISOString() }], averageRating: 5 },
      }),
      '/api/customer-auth/me': () => ({ status: 401, json: {} }),
    });
    render(<TenantHome />);
    await waitFor(() => expect(screen.getByText('★ 5.0 (1 review)')).toBeInTheDocument());
    expect(screen.getByText('Great!')).toBeInTheDocument();
  });

  it('shows the map and a "Get directions" link when a location is set', async () => {
    mockFetch({
      '/api/public/tenants/demo': () => ({
        json: { ...baseData, settings: { ...baseData.settings, location: { address: '1 Main St', lat: 40.7, lng: -74 } } },
      }),
      '/api/customer-auth/me': () => ({ status: 401, json: {} }),
    });
    render(<TenantHome />);
    await waitFor(() => expect(screen.getByTestId('mock-salon-map')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Get directions →' })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=40.7,-74'
    );
  });

  it('clicking the favorite button while signed out opens the sign-in modal', async () => {
    mockFetch({
      '/api/public/tenants/demo': () => ({ json: baseData }),
      '/api/customer-auth/me': () => ({ status: 401, json: {} }),
    });
    render(<TenantHome />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Demo Salon' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '♡ Save' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeInTheDocument());
  });

  it('when signed in and already favorited, shows the saved state and un-favorites on click', async () => {
    const fetchMock = mockFetch({
      '/api/public/tenants/demo': () => ({ json: baseData }),
      '/api/customer-auth/me': () => ({ json: { customerId: 'c1', name: 'Jamie', email: 'j@example.test' } }),
      '/api/favorites': (url, init) => {
        if (init?.method === 'DELETE') return { json: { message: 'ok' } };
        return { json: [{ tenantId: 't1' }] };
      },
    });
    render(<TenantHome />);
    await waitFor(() => expect(screen.getByRole('button', { name: '♥ Saved' })).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '♥ Saved' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '♡ Save' })).toBeInTheDocument());
    const deleteCall = fetchMock.mock.calls.find((c: any) => c[1]?.method === 'DELETE');
    expect(deleteCall![0]).toContain('tenantId=t1');
  });
});
