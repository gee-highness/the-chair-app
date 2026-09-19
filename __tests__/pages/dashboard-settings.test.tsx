// __tests__/pages/dashboard-settings.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRole } from '../helpers/testProviders';
import { mockFetch } from '../helpers/fetchMock';
import SettingsPage from '@/app/t/[tenantSlug]/dashboard/settings/page';

vi.mock('@/components/dashboard/LocationPicker', () => ({
  LocationPicker: (props: any) => <div data-testid="mock-location-picker" data-address={props.value.address} />,
}));

const originalFetch = global.fetch;

describe('Settings dashboard page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('a non-admin sees the access-denied EmptyState and never calls the settings API', () => {
    const fetchMock = mockFetch({});
    renderWithRole(<SettingsPage />, 'receptionist');
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an admin sees the loaded settings form', async () => {
    mockFetch({
      '/api/tenant/settings': () => ({
        json: {
          tenant: { branding: { primaryColor: '#111', secondaryColor: '#222', font: 'modern' } },
          settings: { title: 'Demo Salon', description: 'A great salon', phone: '555-0100', email: 'x@example.test', location: { address: '1 Main St', lat: 1, lng: 2 } },
        },
      }),
    });
    renderWithRole(<SettingsPage />, 'admin');
    await waitFor(() => expect(screen.getByLabelText('Business name')).toHaveValue('Demo Salon'));
    expect(screen.getByLabelText('Phone')).toHaveValue('555-0100');
  });

  it('saving calls PUT with the current settings/branding and shows a success toast', async () => {
    const fetchMock = mockFetch({
      '/api/tenant/settings': (url, init) => {
        if (init?.method === 'PUT') return { json: { message: 'ok' } };
        return { json: { tenant: { branding: { primaryColor: '#111', font: 'modern' } }, settings: { title: '', description: '', phone: '', email: '', location: { address: '', lat: 0, lng: 0 } } } };
      },
    });
    renderWithRole(<SettingsPage />, 'admin');
    await waitFor(() => expect(screen.getByLabelText('Business name')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Business name'), 'New Name');
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find((c: any) => c[1]?.method === 'PUT');
      expect(putCall).toBeTruthy();
      const body = JSON.parse(putCall![1].body);
      expect(body.settings.title).toBe('New Name');
    });
  });
});
