// src/components/dashboard/LocationPickerMap.tsx
//
// The actual Leaflet map. Split into its own file so the parent
// (LocationPicker.tsx) can dynamic-import it with { ssr: false } — Leaflet
// touches `window` at module load time and breaks server rendering
// otherwise. Uses OpenStreetMap tiles (no API key required); see the
// attribution requirement in the tile layer below, which OSM's tile usage
// policy requires and must not be removed.
'use client';
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icon paths break under bundlers unless
// re-pointed at CDN-hosted copies of the same images.
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function ClickToMove({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export default function LocationPickerMap({
  lat,
  lng,
  onMove,
}: {
  lat: number;
  lng: number;
  onMove: (lat: number, lng: number) => void;
}) {
  return (
    <MapContainer center={[lat, lng]} zoom={14} style={{ height: '320px', width: '100%', borderRadius: 'var(--radius-ticket)' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker
        position={[lat, lng]}
        icon={markerIcon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const marker = e.target;
            const pos = marker.getLatLng();
            onMove(pos.lat, pos.lng);
          },
        }}
      />
      <ClickToMove onMove={onMove} />
      <Recenter lat={lat} lng={lng} />
    </MapContainer>
  );
}
