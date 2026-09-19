// __tests__/pages/booking-page.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFetch } from '../helpers/fetchMock';

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantSlug: 'demo' }),
}));

import BookPage from '@/app/t/[tenantSlug]/book/page';

const originalFetch = global.fetch;

const tenantDetails = {
  services: [{ _id: 's1', name: 'Classic Fade', price: 25, duration: 30 }],
  barbers: [{ _id: 'b1', name: 'Alex', tags: ['Fades'] }],
  categories: [],
};

const isoSlot = new Date(Date.now() + 3600_000).toISOString();

describe('Booking page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shows an empty state when the tenant has no services listed', async () => {
    mockFetch({ '/api/public/tenants/demo': () => ({ json: { services: [], barbers: [], categories: [] } }) });
    render(<BookPage />);
    await waitFor(() => expect(screen.getByText('No services listed yet')).toBeInTheDocument());
  });

  it('completes the full 4-step flow and shows no false "email sent" claim on confirmation', async () => {
    const fetchMock = mockFetch({
      '/api/public/tenants/demo': () => ({ json: tenantDetails }),
      '/api/t/demo/book': (url, init) => {
        if (init?.method === 'POST') return { status: 201, json: { message: 'Booked' } };
        return { json: { slots: [isoSlot] } };
      },
    });
    render(<BookPage />);

    // Step 1: choose service
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Choose a service' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Classic Fade/ }));

    // Step 2: choose barber
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Choose a barber' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Alex/ }));

    // Step 3: pick a time
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Pick a time' })).toBeInTheDocument());
    const slotButton = await screen.findByRole('button', { name: new RegExp(new Date(isoSlot).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) });
    await userEvent.click(slotButton);
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 4: contact details
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Your details' })).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Name'), 'Jamie Customer');
    await userEvent.type(screen.getByLabelText('Email'), 'jamie@example.test');
    await userEvent.type(screen.getByLabelText('Phone'), '555-0100');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));

    await waitFor(() => expect(screen.getByText("You're on the books")).toBeInTheDocument());
    // Priority 1 regression: no claim that a confirmation email was sent.
    expect(screen.queryByText(/sent to/i)).not.toBeInTheDocument();
    expect(screen.getByText(/save this confirmation/i)).toBeInTheDocument();

    const postCall = fetchMock.mock.calls.find((c: any) => c[1]?.method === 'POST');
    const body = JSON.parse(postCall![1].body);
    expect(body).toMatchObject({ customerName: 'Jamie Customer', customerEmail: 'jamie@example.test', customerPhone: '555-0100', serviceId: 's1', barberId: 'b1', dateTime: isoSlot });
  });

  it('shows "No open times that day" when the barber has nothing free', async () => {
    mockFetch({
      '/api/public/tenants/demo': () => ({ json: tenantDetails }),
      '/api/t/demo/book': () => ({ json: { slots: [] } }),
    });
    render(<BookPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Classic Fade/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Alex/ }));
    await waitFor(() => expect(screen.getByText('No open times that day')).toBeInTheDocument());
  });

  it('"Continue" is disabled until a time slot is selected', async () => {
    mockFetch({
      '/api/public/tenants/demo': () => ({ json: tenantDetails }),
      '/api/t/demo/book': () => ({ json: { slots: [isoSlot] } }),
    });
    render(<BookPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Classic Fade/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Alex/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled());
  });

  it('a double-booking conflict (409) shows an error toast and does not show the confirmation screen', async () => {
    mockFetch({
      '/api/public/tenants/demo': () => ({ json: tenantDetails }),
      '/api/t/demo/book': (url, init) => {
        if (init?.method === 'POST') return { status: 409, json: { message: 'That slot was just booked by someone else' } };
        return { json: { slots: [isoSlot] } };
      },
    });
    render(<BookPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Classic Fade/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Alex/ }));
    const slotButton = await screen.findByRole('button', { name: new RegExp(new Date(isoSlot).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) });
    await userEvent.click(slotButton);
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Your details' })).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Name'), 'Jamie');
    await userEvent.type(screen.getByLabelText('Email'), 'jamie@example.test');
    await userEvent.type(screen.getByLabelText('Phone'), '555-0100');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));

    await waitFor(() => expect(screen.getByText('That slot was just booked by someone else')).toBeInTheDocument());
    expect(screen.queryByText("You're on the books")).not.toBeInTheDocument();
  });

  it('"Change service" and "Change barber" back-buttons return to earlier steps', async () => {
    mockFetch({
      '/api/public/tenants/demo': () => ({ json: tenantDetails }),
      '/api/t/demo/book': () => ({ json: { slots: [isoSlot] } }),
    });
    render(<BookPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Classic Fade/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Alex/ }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Pick a time' })).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '← Change barber' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Choose a barber' })).toBeInTheDocument());
  });
});
