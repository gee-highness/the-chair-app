// __tests__/pages/dashboard-waitlist.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFetch } from '../helpers/fetchMock';
import WaitlistPage from '@/app/t/[tenantSlug]/dashboard/waitlist/page';

const originalFetch = global.fetch;

describe('Waitlist dashboard page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shows only waitlist-status appointments, numbered by position', async () => {
    mockFetch({
      '/api/appointments': () => ({
        json: [
          { _id: '1', status: 'waitlist', customerName: 'Jamie', serviceName: 'Fade', barberName: 'Alex' },
          { _id: '2', status: 'confirmed', customerName: 'Not On Waitlist' },
        ],
      }),
      '/api/barbers': () => ({ json: [] }),
      '/api/services': () => ({ json: [] }),
    });
    render(<WaitlistPage />);
    await waitFor(() => expect(screen.getByText('Jamie')).toBeInTheDocument());
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.queryByText('Not On Waitlist')).not.toBeInTheDocument();
  });

  it('shows an empty state when the waitlist is empty', async () => {
    mockFetch({
      '/api/appointments': () => ({ json: [] }),
      '/api/barbers': () => ({ json: [] }),
      '/api/services': () => ({ json: [] }),
    });
    render(<WaitlistPage />);
    await waitFor(() => expect(screen.getByText('Waitlist is empty')).toBeInTheDocument());
  });

  it('"Seat now" updates the appointment to confirmed and refreshes the list', async () => {
    let entries = [{ _id: '1', status: 'waitlist', customerName: 'Jamie' }];
    const fetchMock = mockFetch({
      '/api/appointments': (url, init) => {
        if (init?.method === 'PUT') {
          entries = [];
          return { json: { message: 'ok' } };
        }
        return { json: entries };
      },
      '/api/barbers': () => ({ json: [] }),
      '/api/services': () => ({ json: [] }),
    });
    render(<WaitlistPage />);
    await waitFor(() => expect(screen.getByText('Jamie')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Seat now' }));
    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find((c: any) => c[1]?.method === 'PUT');
      expect(JSON.parse(putCall![1].body)).toEqual({ _id: '1', status: 'confirmed' });
    });
    await waitFor(() => expect(screen.getByText('Waitlist is empty')).toBeInTheDocument());
  });

  it('adding a walk-in creates a customer, then a waitlist appointment for them', async () => {
    const fetchMock = mockFetch({
      '/api/appointments': (url, init) => {
        if (init?.method === 'POST') return { status: 201, json: { _id: 'a1' } };
        return { json: [] };
      },
      '/api/customers': (url, init) => {
        if (init?.method === 'POST') return { status: 201, json: { _id: 'c1' } };
        return { json: [] };
      },
      '/api/barbers': () => ({ json: [{ _id: 'b1', name: 'Alex' }] }),
      '/api/services': () => ({ json: [{ _id: 's1', name: 'Fade' }] }),
    });
    render(<WaitlistPage />);
    await waitFor(() => expect(screen.getByText('Waitlist is empty')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Add walk-in' }));
    await userEvent.type(screen.getByLabelText('Customer name'), 'Jamie');
    await userEvent.type(screen.getByLabelText('Email'), 'jamie@example.test');
    await userEvent.type(screen.getByLabelText('Phone'), '555-0100');
    await userEvent.selectOptions(screen.getByLabelText('Barber'), 'b1');
    await userEvent.selectOptions(screen.getByLabelText('Service'), 's1');
    await userEvent.click(screen.getByRole('button', { name: 'Add to waitlist' }));

    await waitFor(() => {
      const apptPost = fetchMock.mock.calls.find((c: any) => c[0].includes('/api/appointments') && c[1]?.method === 'POST');
      expect(apptPost).toBeTruthy();
      const body = JSON.parse(apptPost![1].body);
      expect(body).toEqual({ customerId: 'c1', barberId: 'b1', serviceId: 's1', status: 'waitlist', source: 'walk-in' });
    });
  });
});
