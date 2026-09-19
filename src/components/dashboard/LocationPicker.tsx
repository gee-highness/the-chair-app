// src/components/dashboard/LocationPicker.tsx
'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './LocationPicker.module.css';

const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Loading map…</div>,
});

interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

export function LocationPicker({
  value,
  onChange,
}: {
  value: { address: string; lat: number; lng: number };
  onChange: (loc: { address: string; lat: number; lng: number }) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (query.trim().length < 3) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      if (res.ok) setResults(await res.json());
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: GeocodeResult) => {
    onChange({ address: r.label, lat: r.lat, lng: r.lng });
    setResults([]);
    setQuery('');
  };

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      onChange({ ...value, lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
  };

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Location</span>

      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          placeholder="Search for an address"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())}
        />
        <Button type="button" size="sm" variant="secondary" loading={searching} onClick={search}>
          Search
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={useMyLocation}>
          Use my location
        </Button>
      </div>

      {results.length > 0 && (
        <ul className={styles.results}>
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" className={styles.resultButton} onClick={() => pickResult(r)}>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.hint}>Drag the pin, or click the map, to fine-tune the exact spot.</p>
      <LocationPickerMap lat={value.lat} lng={value.lng} onMove={(lat, lng) => onChange({ ...value, lat, lng })} />

      <label className={styles.addressLabel}>
        Address shown to customers
        <input
          className={styles.addressInput}
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder="123 Main St, Springfield"
        />
      </label>
    </div>
  );
}
