// __tests__/pages/dashboard-reviews.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRole } from '../helpers/testProviders';
import { mockFetch } from '../helpers/fetchMock';
import ReviewsPage from '@/app/t/[tenantSlug]/dashboard/reviews/page';

const originalFetch = global.fetch;

const sampleReviews = [
  { _id: 'r1', customerName: 'Jamie', barberName: 'Alex', rating: 5, text: 'Great cut', status: 'visible', createdAt: new Date().toISOString() },
  { _id: 'r2', customerName: 'Sam', barberName: 'Alex', rating: 2, text: '', status: 'visible', createdAt: new Date().toISOString() },
];

describe('Reviews dashboard page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('a non-admin sees the access-denied EmptyState and never fetches reviews', () => {
    const fetchMock = mockFetch({});
    renderWithRole(<ReviewsPage />, 'receptionist');
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists reviews with customer/barber names, star rating, and status', async () => {
    mockFetch({ '/api/reviews': () => ({ json: sampleReviews }) });
    renderWithRole(<ReviewsPage />, 'admin');
    await waitFor(() => expect(screen.getByText('Jamie')).toBeInTheDocument());
    expect(screen.getByText('Sam')).toBeInTheDocument();
    expect(screen.getByText('No written review')).toBeInTheDocument(); // Sam's empty text
    expect(screen.getAllByText('Visible')).toHaveLength(2);
  });

  it('searching filters by customer, barber, or review text', async () => {
    mockFetch({ '/api/reviews': () => ({ json: sampleReviews }) });
    renderWithRole(<ReviewsPage />, 'admin');
    await waitFor(() => expect(screen.getByText('Jamie')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Search reviews'), 'Jamie');
    expect(screen.getByText('Jamie')).toBeInTheDocument();
    expect(screen.queryByText('Sam')).not.toBeInTheDocument();
  });

  it('flagging a review calls PUT with status:flagged and updates the row optimistically', async () => {
    const fetchMock = mockFetch({
      '/api/reviews': (url, init) => {
        if (init?.method === 'PUT') return { json: { ...sampleReviews[0], status: 'flagged' } };
        return { json: sampleReviews };
      },
    });
    renderWithRole(<ReviewsPage />, 'admin');
    await waitFor(() => expect(screen.getByText('Jamie')).toBeInTheDocument());

    const flagButtons = screen.getAllByRole('button', { name: 'Flag' });
    await userEvent.click(flagButtons[0]);

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find((c: any) => c[1]?.method === 'PUT');
      expect(putCall).toBeTruthy();
      expect(JSON.parse(putCall![1].body)).toEqual({ _id: 'r1', status: 'flagged' });
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unflag' })).toBeInTheDocument());
  });

  it('shows an empty state when there are no reviews yet', async () => {
    mockFetch({ '/api/reviews': () => ({ json: [] }) });
    renderWithRole(<ReviewsPage />, 'admin');
    await waitFor(() => expect(screen.getByText('No reviews yet')).toBeInTheDocument());
  });
});
