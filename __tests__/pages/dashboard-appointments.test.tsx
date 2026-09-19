// __tests__/pages/dashboard-appointments.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFetch } from '../helpers/fetchMock';
import AppointmentsBoard from '@/app/t/[tenantSlug]/dashboard/appointments/page';

const originalFetch = global.fetch;

describe('Appointments dashboard board', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('waitlist-status appointments are excluded from this board (they have their own page)', async () => {
    mockFetch({
      '/api/appointments': () => ({
        json: [{ _id: '1', dateTime: new Date().toISOString(), status: 'waitlist', serviceName: 'Fade' }],
      }),
    });
    render(<AppointmentsBoard />);
    await userEvent.click(screen.getByRole('button', { name: 'All dates' }));
    await waitFor(() => expect(screen.getByText('No appointments match')).toBeInTheDocument());
  });

  it('shows appointments with service/barber/customer/price', async () => {
    mockFetch({
      '/api/appointments': () => ({
        json: [{ _id: '1', dateTime: new Date().toISOString(), status: 'confirmed', serviceName: 'Fade', barberName: 'Alex', customerName: 'Jamie', servicePrice: 25 }],
      }),
    });
    render(<AppointmentsBoard />);
    await userEvent.click(screen.getByRole('button', { name: 'All dates' }));
    await waitFor(() => expect(screen.getByText('Fade')).toBeInTheDocument());
    expect(screen.getByText(/Jamie/)).toBeInTheDocument();
    expect(screen.getByText(/Alex/)).toBeInTheDocument();
  });

  it('marks a walk-in appointment distinctly', async () => {
    mockFetch({
      '/api/appointments': () => ({
        json: [{ _id: '1', dateTime: new Date().toISOString(), status: 'confirmed', serviceName: 'Fade', source: 'walk-in' }],
      }),
    });
    render(<AppointmentsBoard />);
    await userEvent.click(screen.getByRole('button', { name: 'All dates' }));
    await waitFor(() => expect(screen.getByText('walk-in')).toBeInTheDocument());
  });

  it('changing the status select calls PUT with the new status', async () => {
    const fetchMock = mockFetch({
      '/api/appointments': (url, init) => {
        if (init?.method === 'PUT') return { json: { message: 'ok' } };
        return { json: [{ _id: '1', dateTime: new Date().toISOString(), status: 'pending', serviceName: 'Fade' }] };
      },
    });
    render(<AppointmentsBoard />);
    await userEvent.click(screen.getByRole('button', { name: 'All dates' }));
    await waitFor(() => expect(screen.getByText('Fade')).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Change status'), 'confirmed');

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find((c: any) => c[1]?.method === 'PUT');
      expect(putCall).toBeTruthy();
      expect(JSON.parse(putCall![1].body)).toEqual({ _id: '1', status: 'confirmed' });
    });
  });

  it('the status filter narrows the list to that status only', async () => {
    mockFetch({
      '/api/appointments': () => ({
        json: [
          { _id: '1', dateTime: new Date().toISOString(), status: 'pending', serviceName: 'Pending Service' },
          { _id: '2', dateTime: new Date().toISOString(), status: 'confirmed', serviceName: 'Confirmed Service' },
        ],
      }),
    });
    render(<AppointmentsBoard />);
    await userEvent.click(screen.getByRole('button', { name: 'All dates' }));
    await waitFor(() => expect(screen.getByText('Pending Service')).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'confirmed');
    expect(screen.queryByText('Pending Service')).not.toBeInTheDocument();
    expect(screen.getByText('Confirmed Service')).toBeInTheDocument();
  });
});
