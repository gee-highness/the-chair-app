// __tests__/pages/dashboard-customers.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFetch } from '../helpers/fetchMock';
import CustomersPage from '@/app/t/[tenantSlug]/dashboard/customers/page';

const originalFetch = global.fetch;
const tenantId = '507f1f77bcf86cd799439011';

describe('Customers dashboard page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shows an empty state with no customers yet', async () => {
    mockFetch({
      '/api/customers': () => ({ json: [] }),
      '/api/tenant/settings': () => ({ json: { tenant: { _id: tenantId } } }),
    });
    render(<CustomersPage />);
    await waitFor(() => expect(screen.getByText('No customers yet')).toBeInTheDocument());
  });

  it('lists customers with their loyalty points for this tenant', async () => {
    mockFetch({
      '/api/customers': () => ({ json: [{ _id: 'c1', name: 'Jamie', email: 'jamie@example.test', phone: '555-0100', loyaltyPoints: { [tenantId]: 15 } }] }),
      '/api/tenant/settings': () => ({ json: { tenant: { _id: tenantId } } }),
    });
    render(<CustomersPage />);
    await waitFor(() => expect(screen.getByText('Jamie')).toBeInTheDocument());
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('searching filters by name, email, or phone', async () => {
    mockFetch({
      '/api/customers': () => ({
        json: [
          { _id: 'c1', name: 'Jamie', email: 'jamie@example.test', phone: '555-0100', loyaltyPoints: {} },
          { _id: 'c2', name: 'Sam', email: 'sam@example.test', phone: '555-0200', loyaltyPoints: {} },
        ],
      }),
      '/api/tenant/settings': () => ({ json: { tenant: { _id: tenantId } } }),
    });
    render(<CustomersPage />);
    await waitFor(() => expect(screen.getByText('Jamie')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Search customers'), 'sam@');
    expect(screen.queryByText('Jamie')).not.toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();
  });

  it('shows a dash for loyalty points when the tenantId has not resolved yet', async () => {
    mockFetch({
      '/api/customers': () => ({ json: [{ _id: 'c1', name: 'Jamie', email: 'j@example.test', phone: '555', loyaltyPoints: {} }] }),
      '/api/tenant/settings': () => ({ json: null }),
    });
    render(<CustomersPage />);
    await waitFor(() => expect(screen.getByText('Jamie')).toBeInTheDocument());
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
