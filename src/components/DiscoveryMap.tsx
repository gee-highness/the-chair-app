// src/components/DiscoveryMap.tsx
'use client';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Link from 'next/link';

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface Pin {
  _id: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
}

export default function DiscoveryMap({ center, pins }: { center: { lat: number; lng: number }; pins: Pin[] }) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={12} style={{ height: '280px', width: '100%', borderRadius: 'var(--radius-ticket)' }} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[center.lat, center.lng]} icon={markerIcon}>
        <Popup>You are here</Popup>
      </Marker>
      {pins.map((p) => (
        <Marker key={p._id} position={[p.lat, p.lng]} icon={markerIcon}>
          <Popup>
            <Link href={`/t/${p.slug}`}>{p.name}</Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
