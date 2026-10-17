// src/hooks/useDeferredMount.ts
//
// True one tick after mount. react-leaflet 4 initialises the map in an
// effect and cannot survive React's dev-mode mount/unmount/mount cycle
// ("Map container is already initialized"); deferring the render by a
// timeout lets the cleanup cancel the first attempt so the map is created
// exactly once. Harmless in production.
'use client';
import { useEffect, useState } from 'react';

export function useDeferredMount(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(id);
  }, []);
  return ready;
}
