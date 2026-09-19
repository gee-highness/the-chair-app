// __tests__/components/LocationPicker.test.tsx
//
// LocationPickerMap (the actual Leaflet map) is mocked out entirely —
// it needs real browser geometry APIs Leaflet depends on, and has its
// own dedicated test (LocationPickerMap.test.tsx) with react-leaflet
// itself mocked at a lower level. This file only exercises LocationPicker's
// own logic: the geocode search box, picking a result, the address field,
// and the "Use my location" fallback.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/components/dashboard/LocationPickerMap', () => ({
  default: (props: any) => <div data-testid="mock-map" data-lat={props.lat} data-lng={props.lng} />,
}));

import { LocationPicker } from '@/components/dashboard/LocationPicker';
import { mockFetchOnce } from '../helpers/fetchMock';

const originalFetch = global.fetch;
const originalGeolocation = (global.navigator as any).geolocation;

describe('LocationPicker', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(global.navigator, 'geolocation', { value: originalGeolocation, configurable: true });
  });

  it('renders the address field with the current value', () => {
    render(<LocationPicker value={{ address: '1 Main St', lat: 40.7, lng: -74 }} onChange={() => {}} />);
    expect(screen.getByLabelText(/Address shown to customers/)).toHaveValue('1 Main St');
  });

  it('typing a short query does not search (min 3 characters, enforced client-side too)', async () => {
    const fetchMock = mockFetchOnce([]);
    render(<LocationPicker value={{ address: '', lat: 0, lng: 0 }} onChange={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText('Search for an address'), 'NY');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('searching shows results, and picking one calls onChange and clears the results', async () => {
    mockFetchOnce([{ label: '1 Main St, Testville', lat: 40.7128, lng: -74.006 }]);
    const onChange = vi.fn();
    render(<LocationPicker value={{ address: '', lat: 0, lng: 0 }} onChange={onChange} />);

    await userEvent.type(screen.getByPlaceholderText('Search for an address'), 'Main Street');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    const result = await screen.findByRole('button', { name: '1 Main St, Testville' });
    await userEvent.click(result);

    expect(onChange).toHaveBeenCalledWith({ address: '1 Main St, Testville', lat: 40.7128, lng: -74.006 });
    expect(screen.queryByRole('button', { name: '1 Main St, Testville' })).not.toBeInTheDocument();
  });

  it('editing the address field calls onChange with just the address updated', async () => {
    const onChange = vi.fn();
    render(<LocationPicker value={{ address: '', lat: 40.7, lng: -74 }} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText(/Address shown to customers/), 'X');
    expect(onChange).toHaveBeenCalledWith({ address: 'X', lat: 40.7, lng: -74 });
  });

  it('"Use my location" does nothing when the browser has no geolocation API (no crash)', async () => {
    Object.defineProperty(global.navigator, 'geolocation', { value: undefined, configurable: true });
    const onChange = vi.fn();
    render(<LocationPicker value={{ address: '', lat: 40.7, lng: -74 }} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('"Use my location" calls onChange with the browser\'s coordinates when available', async () => {
    Object.defineProperty(global.navigator, 'geolocation', {
      value: { getCurrentPosition: (cb: any) => cb({ coords: { latitude: 51.5, longitude: -0.12 } }) },
      configurable: true,
    });
    const onChange = vi.fn();
    render(<LocationPicker value={{ address: 'Old Address', lat: 40.7, lng: -74 }} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(onChange).toHaveBeenCalledWith({ address: 'Old Address', lat: 51.5, lng: -0.12 });
  });

  it('renders the (mocked) map with the current lat/lng', async () => {
    render(<LocationPicker value={{ address: '', lat: 40.7, lng: -74 }} onChange={() => {}} />);
    const map = await screen.findByTestId('mock-map');
    expect(map).toHaveAttribute('data-lat', '40.7');
    expect(map).toHaveAttribute('data-lng', '-74');
  });
});
