// __tests__/pages/customer-appointments-page.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFetch } from '../helpers/fetchMock';

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantSlug: 'demo' }),
}));

import AppointmentsPage from '@/app/t/[tenantSlug]/appointments/page';

const originalFetch = global.fetch;

describe('Customer My Appointments page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shows a sign-in prompt when signed out, and opens the modal on click', async () => {
    mockFetch({ '/api/customer-auth/me': () => ({ status: 401, json: {} }) });
    render(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByText('Sign in to see your appointments')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('once signed in, splits appointments into Upcoming and Past, and shows loyalty points', async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const past = new Date(Date.now() - 86400_000).toISOString();
    mockFetch({
      '/api/customer-auth/me': () => ({ json: { customerId: 'c1', name: 'Jamie', email: 'j@example.test' } }),
      '/api/t/demo/my-appointments': () => ({
        json: {
          appointments: [
            { _id: 'a1', dateTime: future, status: 'confirmed', barberName: 'Alex', serviceName: 'Fade' },
            { _id: 'a2', dateTime: past, status: 'completed', barberName: 'Alex', serviceName: 'Beard Trim' },
          ],
          loyaltyPoints: 25,
        },
      }),
    });
    render(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByText('Fade')).toBeInTheDocument());
    expect(screen.getByText('Beard Trim')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave a review' })).toBeInTheDocument();
  });

  it('shows "Nothing upcoming" / "No past appointments yet" when both lists are empty', async () => {
    mockFetch({
      '/api/customer-auth/me': () => ({ json: { customerId: 'c1', name: 'Jamie', email: 'j@example.test' } }),
      '/api/t/demo/my-appointments': () => ({ json: { appointments: [], loyaltyPoints: 0 } }),
    });
    render(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByText('Nothing upcoming')).toBeInTheDocument());
    expect(screen.getByText('No past appointments yet')).toBeInTheDocument();
  });

  it('leaving a review posts to /api/reviews and replaces the button with a status badge', async () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    const fetchMock = mockFetch({
      '/api/customer-auth/me': () => ({ json: { customerId: 'c1', name: 'Jamie', email: 'j@example.test' } }),
      '/api/t/demo/my-appointments': () => ({
        json: { appointments: [{ _id: 'a2', dateTime: past, status: 'completed', barberName: 'Alex', serviceName: 'Beard Trim' }], loyaltyPoints: 0 },
      }),
      '/api/reviews': () => ({ json: { message: 'ok' } }),
    });
    render(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Leave a review' })).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Leave a review' }));
    expect(screen.getByRole('dialog', { name: 'Leave a review' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Comments (optional)'), 'Great cut!');
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Leave a review' })).not.toBeInTheDocument());
    const postCall = fetchMock.mock.calls.find((c: any) => c[0].includes('/api/reviews'));
    const body = JSON.parse(postCall![1].body);
    expect(body).toEqual({ appointmentId: 'a2', rating: 5, text: 'Great cut!' });
    expect(screen.queryByRole('button', { name: 'Leave a review' })).not.toBeInTheDocument();
  });

  it('the star picker changes the submitted rating', async () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    const fetchMock = mockFetch({
      '/api/customer-auth/me': () => ({ json: { customerId: 'c1', name: 'Jamie', email: 'j@example.test' } }),
      '/api/t/demo/my-appointments': () => ({
        json: { appointments: [{ _id: 'a2', dateTime: past, status: 'completed', barberName: 'Alex', serviceName: 'Beard Trim' }], loyaltyPoints: 0 },
      }),
      '/api/reviews': () => ({ json: { message: 'ok' } }),
    });
    render(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Leave a review' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Leave a review' }));

    const stars = screen.getAllByRole('radio');
    await userEvent.click(stars[2]); // 3rd star = rating 3
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find((c: any) => c[0].includes('/api/reviews'));
      const body = JSON.parse(postCall![1].body);
      expect(body.rating).toBe(3);
    });
  });

  it('a failed review submission shows an error toast and keeps the modal open', async () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    mockFetch({
      '/api/customer-auth/me': () => ({ json: { customerId: 'c1', name: 'Jamie', email: 'j@example.test' } }),
      '/api/t/demo/my-appointments': () => ({
        json: { appointments: [{ _id: 'a2', dateTime: past, status: 'completed', barberName: 'Alex', serviceName: 'Beard Trim' }], loyaltyPoints: 0 },
      }),
      '/api/reviews': () => ({ status: 409, json: { message: 'You already reviewed this appointment' } }),
    });
    render(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Leave a review' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Leave a review' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));

    await waitFor(() => expect(screen.getByText('You already reviewed this appointment')).toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'Leave a review' })).toBeInTheDocument(); // still open
  });
});
