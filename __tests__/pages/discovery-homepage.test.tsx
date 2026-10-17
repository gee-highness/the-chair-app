// __tests__/pages/discovery-homepage.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFetch } from '../helpers/fetchMock';

vi.mock('@/components/DiscoveryMap', () => ({
  default: () => <div data-testid="mock-discovery-map" />,
}));

import Home from '@/app/page';

const originalFetch = global.fetch;

describe('Discovery homepage', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('runs a search on mount with no query, showing results without the visitor typing anything (Priority 3 regression)', async () => {
    const fetchMock = mockFetch({
      '/api/public/search': () => ({ json: { tenants: [{ _id: 't1', name: 'Demo Salon', slug: 'demo' }], services: [] } }),
      '/api/customer-auth/me': () => ({ status: 401, json: {} }),
    });
    render(<Home />);
    await waitFor(() => expect(screen.getByText('Demo Salon')).toBeInTheDocument());
    const searchCall = fetchMock.mock.calls.find((c: any) => c[0].includes('/api/public/search'));
    expect(searchCall![0]).toContain('q=');
  });

  it('typing a query and clicking Search re-runs the search with that query', async () => {
    let query = '';
    const fetchMock = mockFetch({
      '/api/public/search': (url) => {
        query = new URL(url, 'http://localhost').searchParams.get('q') || '';
        return { json: { tenants: query === 'fade' ? [{ _id: 't1', name: 'Fade Factory', slug: 'fade-factory' }] : [], services: [] } };
      },
      '/api/customer-auth/me': () => ({ status: 401, json: {} }),
    });
    render(<Home />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    await userEvent.type(screen.getByLabelText('Search'), 'fade');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(screen.getByText('Fade Factory')).toBeInTheDocument());
  });

  it('shows a "No results" empty state after a search with nothing found', async () => {
    mockFetch({
      '/api/public/search': (url) => {
        const q = new URL(url, 'http://localhost').searchParams.get('q');
        return { json: { tenants: [], services: [] } };
      },
      '/api/customer-auth/me': () => ({ status: 401, json: {} }),
    });
    render(<Home />);
    await userEvent.type(screen.getByLabelText('Search'), 'nonexistent-salon-xyz');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(screen.getByText('No results')).toBeInTheDocument());
  });

  it('service results link to their tenant\'s page', async () => {
    mockFetch({
      '/api/public/search': () => ({
        json: { tenants: [], services: [{ _id: 's1', tenantId: 't1', tenantName: 'Fade Factory', tenantSlug: 'fade-factory', name: 'Classic Cut', price: 25, duration: 30 }] },
      }),
      '/api/customer-auth/me': () => ({ status: 401, json: {} }),
    });
    render(<Home />);
    await waitFor(() => expect(screen.getByText('Classic Cut')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /Classic Cut/ })).toHaveAttribute('href', '/t/fade-factory');
  });

  it('favoriting a tenant while signed out opens the sign-in modal instead of calling the favorites API directly', async () => {
    const fetchMock = mockFetch({
      '/api/public/search': () => ({ json: { tenants: [{ _id: 't1', name: 'Demo Salon', slug: 'demo' }], services: [] } }),
      '/api/customer-auth/me': () => ({ status: 401, json: {} }),
    });
    render(<Home />);
    await waitFor(() => expect(screen.getByText('Demo Salon')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /Save .* as favorite/ }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeInTheDocument());
    expect(fetchMock.mock.calls.find((c: any) => c[0].includes('/api/favorites'))).toBeUndefined();
  });

  describe('apps installed on this device', () => {
    const seed = (apps: any[]) => localStorage.setItem('chair_installed_apps', JSON.stringify(apps));
    const search = () =>
      mockFetch({
        '/api/public/search': () => ({
          json: {
            tenants: [{ _id: 't1', name: 'Demo Salon', slug: 'demo' }, { _id: 't2', name: 'Other Salon', slug: 'other' }],
            services: [],
            barbers: [{ _id: 'b1', name: 'Alex Rivera', slug: 'alex', tags: [], tenantName: 'Demo Salon', tenantSlug: 'demo', reviewCount: 0, followerCount: 0 }],
          },
        }),
        '/api/customer-auth/me': () => ({ status: 401, json: {} }),
      });
    afterEach(() => localStorage.clear());

    it('shows nothing extra when no app has been installed', async () => {
      search();
      render(<Home />);
      await screen.findByText('Other Salon');
      expect(screen.queryByRole('heading', { name: 'Your apps' })).not.toBeInTheDocument();
      expect(screen.queryByText('Installed')).not.toBeInTheDocument();
    });

    it('lists installed salons and barbers under "Your apps", linking to each app', async () => {
      seed([
        { kind: 'salon', slug: 'demo', name: 'Demo Salon', at: 2 },
        { kind: 'barber', slug: 'demo', barberSlug: 'alex', name: 'Alex Rivera', at: 1 },
      ]);
      search();
      render(<Home />);
      const heading = await screen.findByRole('heading', { name: 'Your apps' });
      const section = heading.closest('section')!;
      expect(section.querySelector('a[href="/t/demo"]')).not.toBeNull();
      expect(section.querySelector('a[href="/t/demo/barbers/alex"]')).not.toBeNull();
      expect(section).toHaveTextContent('Installed · Salon');
      expect(section).toHaveTextContent('Installed · Barber');
    });

    it('badges installed salons and barbers in the results, and only those', async () => {
      seed([{ kind: 'salon', slug: 'demo', name: 'Demo Salon', at: 1 }, { kind: 'barber', slug: 'demo', barberSlug: 'alex', name: 'Alex Rivera', at: 2 }]);
      search();
      render(<Home />);
      const otherCard = (await screen.findByText('Other Salon')).closest('a')!;
      expect(otherCard).not.toHaveTextContent('Installed');
      const demoCard = screen.getAllByText('Demo Salon').map((el) => el.closest('a')).find((a) => a?.getAttribute('href') === '/t/demo' && a.className.includes('tenantCard'))!;
      expect(demoCard).toHaveTextContent('Installed');
    });

    it('lets the visitor remove an app they have uninstalled', async () => {
      seed([{ kind: 'salon', slug: 'demo', name: 'Demo Salon', at: 1 }]);
      search();
      render(<Home />);
      await userEvent.click(await screen.findByRole('button', { name: 'Remove Demo Salon from this list' }));
      expect(screen.queryByRole('heading', { name: 'Your apps' })).not.toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem('chair_installed_apps')!)).toEqual([]);
    });
  });
});
