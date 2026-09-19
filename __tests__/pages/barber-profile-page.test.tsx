// __tests__/pages/barber-profile-page.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { mockFetch } from '../helpers/fetchMock';

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantSlug: 'demo', barberSlug: 'alex' }),
}));

import BarberProfilePage from '@/app/t/[tenantSlug]/barbers/[barberSlug]/page';

const originalFetch = global.fetch;

describe('Barber profile page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shows "Barber not found" when the slug does not match any barber', async () => {
    mockFetch({ '/api/public/tenants/demo': () => ({ json: { barbers: [{ _id: 'b2', name: 'Sam', slug: 'sam' }] } }) });
    render(<BarberProfilePage />);
    await waitFor(() => expect(screen.getByText('Barber not found')).toBeInTheDocument());
  });

  it('shows the matched barber\'s name, tags, bio, and a Book link using their first name', async () => {
    mockFetch({
      '/api/public/tenants/demo': () => ({
        json: { barbers: [{ _id: 'b1', name: 'Alex Rivera', slug: 'alex', bio: 'Fades and tapers.', tags: ['Fades', 'Tapers'] }] },
      }),
    });
    render(<BarberProfilePage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Alex Rivera' })).toBeInTheDocument());
    expect(screen.getByText('Fades · Tapers')).toBeInTheDocument();
    expect(screen.getByText('Fades and tapers.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Book with Alex' })).toHaveAttribute('href', '/t/demo/book');
  });

  it('shows a portfolio grid when the barber has photos', async () => {
    mockFetch({
      '/api/public/tenants/demo': () => ({
        json: { barbers: [{ _id: 'b1', name: 'Alex', slug: 'alex', portfolio: ['a.jpg', 'b.jpg'] }] },
      }),
    });
    const { container } = render(<BarberProfilePage />);
    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2));
  });

  it('404 (null tenant data) also shows "Barber not found" rather than crashing', async () => {
    mockFetch({ '/api/public/tenants/demo': () => ({ status: 404, json: { message: 'Tenant not found' } }) });
    render(<BarberProfilePage />);
    await waitFor(() => expect(screen.getByText('Barber not found')).toBeInTheDocument());
  });
});
