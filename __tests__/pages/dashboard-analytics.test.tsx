// __tests__/pages/dashboard-analytics.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRole } from '../helpers/testProviders';
import { mockFetch } from '../helpers/fetchMock';
import AnalyticsPage from '@/app/t/[tenantSlug]/dashboard/analytics/page';

const originalFetch = global.fetch;

describe('Analytics dashboard page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('a non-admin sees the access-denied EmptyState instead of an infinite skeleton (Priority 2 regression)', () => {
    const fetchMock = mockFetch({});
    renderWithRole(<AnalyticsPage />, 'receptionist');
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an admin sees the fetched stats once loaded', async () => {
    mockFetch({
      '/api/analytics': () => ({
        json: {
          timeline: [{ day: '2026-01-01', bookings: 2, revenue: 50 }],
          topBarbers: [{ name: 'Alex', count: 2 }],
          topServices: [{ name: 'Fade', count: 2 }],
          totalRevenue: 50,
          totalBookings: 2,
          days: 30,
        },
      }),
    });
    renderWithRole(<AnalyticsPage />, 'admin');
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument()); // totalBookings stat
    expect(screen.getByText('$50')).toBeInTheDocument();
  });

  it('shows an empty state for the timeline when there are no bookings in the window', async () => {
    mockFetch({
      '/api/analytics': () => ({
        json: { timeline: [], topBarbers: [], topServices: [], totalRevenue: 0, totalBookings: 0, days: 30 },
      }),
    });
    renderWithRole(<AnalyticsPage />, 'admin');
    await waitFor(() => expect(screen.getByText('No bookings in this window')).toBeInTheDocument());
  });
});
