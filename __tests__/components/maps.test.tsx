// __tests__/components/maps.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center }: any) => (
    <div data-testid="map-container" data-center={JSON.stringify(center)}>
      {children}
    </div>
  ),
  TileLayer: (props: any) => <div data-testid="tile-layer" data-url={props.url} />,
  Marker: ({ children, position }: any) => (
    <div data-testid="marker" data-position={JSON.stringify(position)}>
      {children}
    </div>
  ),
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
}));

vi.mock('leaflet', () => ({
  default: { icon: (opts: any) => opts },
}));

import DiscoveryMap from '@/components/DiscoveryMap';
import SalonMapView from '@/components/SalonMapView';

describe('DiscoveryMap', () => {
  it('renders a marker for the user\'s location, plus one per pin, each linking to its salon', () => {
    render(
      <DiscoveryMap
        center={{ lat: 40.7, lng: -74 }}
        pins={[
          { _id: '1', name: 'Fade Factory', slug: 'fade-factory', lat: 40.71, lng: -74.01 },
          { _id: '2', name: 'Clip Joint', slug: 'clip-joint', lat: 40.72, lng: -74.02 },
        ]}
      />
    );
    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(3); // "you are here" + 2 salons
    expect(screen.getByRole('link', { name: 'Fade Factory' })).toHaveAttribute('href', '/t/fade-factory');
    expect(screen.getByRole('link', { name: 'Clip Joint' })).toHaveAttribute('href', '/t/clip-joint');
    expect(screen.getByText('You are here')).toBeInTheDocument();
  });

  it('renders no salon markers (just "you are here") when there are no pins', () => {
    render(<DiscoveryMap center={{ lat: 40.7, lng: -74 }} pins={[]} />);
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
  });
});

describe('SalonMapView', () => {
  it('renders a single marker centered on the given coordinates, with no popup/link (read-only)', () => {
    render(<SalonMapView lat={40.7} lng={-74} />);
    expect(screen.getByTestId('map-container')).toHaveAttribute('data-center', JSON.stringify([40.7, -74]));
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });
});
