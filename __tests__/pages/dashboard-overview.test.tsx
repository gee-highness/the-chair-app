// __tests__/pages/dashboard-overview.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { mockFetch } from '../helpers/fetchMock';

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantSlug: 'demo' }),
}));

import DashboardOverview from '@/app/t/[tenantSlug]/dashboard/page';

const originalFetch = global.fetch;

describe('Dashboard Overview page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shows counts of services/barbers/customers and today\'s appointments', async () => {
    const now = new Date();
    mockFetch({
      '/api/appointments': () => ({ json: [{ _id: '1', dateTime: now.toISOString(), status: 'confirmed' }] }),
      '/api/services': () => ({ json: [{ _id: 's1' }, { _id: 's2' }] }),
      '/api/barbers': () => ({ json: [{ _id: 'b1' }] }),
      '/api/customers': () => ({ json: [{ _id: 'c1' }, { _id: 'c2' }, { _id: 'c3' }] }),
    });
    render(<DashboardOverview />);
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument()); // services count
    expect(screen.getByText('1')).toBeInTheDocument(); // barbers count
    expect(screen.getByText('3')).toBeInTheDocument(); // customers count
  });

  it('shows an empty state when nothing is on the books today', async () => {
    mockFetch({
      '/api/appointments': () => ({ json: [] }),
      '/api/services': () => ({ json: [] }),
      '/api/barbers': () => ({ json: [] }),
      '/api/customers': () => ({ json: [] }),
    });
    render(<DashboardOverview />);
    await waitFor(() => expect(screen.getByText('Nothing on the books today')).toBeInTheDocument());
  });

  it('a link to view all appointments is present', async () => {
    mockFetch({
      '/api/appointments': () => ({ json: [] }),
      '/api/services': () => ({ json: [] }),
      '/api/barbers': () => ({ json: [] }),
      '/api/customers': () => ({ json: [] }),
    });
    render(<DashboardOverview />);
    expect(screen.getByRole('link', { name: 'View all appointments' })).toHaveAttribute('href', '/t/demo/dashboard/appointments');
  });
});
