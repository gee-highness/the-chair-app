// __tests__/hooks/useStandalone.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStandalone } from '@/hooks/useStandalone';

const realMatchMedia = window.matchMedia;

function stubDisplayMode(standalone: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: standalone && q.includes('standalone'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as any;
}

describe('useStandalone', () => {
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  it('is false in a normal browser tab', () => {
    stubDisplayMode(false);
    expect(renderHook(() => useStandalone()).result.current).toBe(false);
  });

  it('is true when running as an installed app', () => {
    stubDisplayMode(true);
    expect(renderHook(() => useStandalone()).result.current).toBe(true);
  });
});
