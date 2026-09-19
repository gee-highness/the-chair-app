// __tests__/components/LocationPickerMap.test.tsx
//
// react-leaflet/leaflet are mocked — they need real browser geometry APIs
// this environment doesn't provide, and the app's own logic (click-to-move,
// marker drag, recenter) is what's worth testing, not Leaflet's internals.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const captured = vi.hoisted(() => ({ mapEventHandlers: null as any, setViewCalls: [] as any[] }));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center }: any) => (
    <div data-testid="map-container" data-center={JSON.stringify(center)}>
      {children}
    </div>
  ),
  TileLayer: (props: any) => <div data-testid="tile-layer" data-url={props.url} />,
  Marker: ({ position, eventHandlers }: any) => (
    <button
      data-testid="marker"
      data-position={JSON.stringify(position)}
      onClick={() => eventHandlers?.dragend?.({ target: { getLatLng: () => ({ lat: 12.34, lng: 56.78 }) } })}
    >
      marker
    </button>
  ),
  useMapEvents: (handlers: any) => {
    captured.mapEventHandlers = handlers;
    return null;
  },
  useMap: () => ({
    setView: (...args: any[]) => captured.setViewCalls.push(args),
    getZoom: () => 14,
  }),
}));

vi.mock('leaflet', () => ({
  default: {
    icon: (opts: any) => opts,
  },
}));

import LocationPickerMap from '@/components/dashboard/LocationPickerMap';

describe('LocationPickerMap', () => {
  it('renders the map container centered on the given lat/lng, and a tile layer', () => {
    render(<LocationPickerMap lat={40.7} lng={-74} onMove={() => {}} />);
    expect(screen.getByTestId('map-container')).toHaveAttribute('data-center', JSON.stringify([40.7, -74]));
    expect(screen.getByTestId('tile-layer')).toHaveAttribute('data-url', 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
  });

  it('dragging the marker calls onMove with the new position', async () => {
    const onMove = vi.fn();
    render(<LocationPickerMap lat={40.7} lng={-74} onMove={onMove} />);
    await userEvent.click(screen.getByTestId('marker')); // simulates the dragend handler firing
    expect(onMove).toHaveBeenCalledWith(12.34, 56.78);
  });

  it('clicking the map (via useMapEvents\' click handler) calls onMove', () => {
    const onMove = vi.fn();
    render(<LocationPickerMap lat={40.7} lng={-74} onMove={onMove} />);
    captured.mapEventHandlers.click({ latlng: { lat: 1, lng: 2 } });
    expect(onMove).toHaveBeenCalledWith(1, 2);
  });

  it('does NOT recenter the map on first render (avoids fighting the user\'s own pan/zoom on mount)', () => {
    captured.setViewCalls = [];
    render(<LocationPickerMap lat={40.7} lng={-74} onMove={() => {}} />);
    expect(captured.setViewCalls).toHaveLength(0);
  });

  it('DOES recenter when lat/lng change after the initial render', () => {
    captured.setViewCalls = [];
    const { rerender } = render(<LocationPickerMap lat={40.7} lng={-74} onMove={() => {}} />);
    rerender(<LocationPickerMap lat={41} lng={-75} onMove={() => {}} />);
    expect(captured.setViewCalls).toHaveLength(1);
    expect(captured.setViewCalls[0][0]).toEqual([41, -75]);
  });
});
