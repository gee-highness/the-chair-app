// __tests__/setup/vitest.setup.ts
//
// Runs before every test file (both the `node`-environment route tests and
// the `jsdom`-environment component/page tests — see vitest.config.ts).
// Everything here is safe under `node` too: jest-dom's matchers are only
// invoked when a jsdom test actually calls them, and the polyfills below
// only touch `window`/`document` when they exist.
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmounts every rendered component after each test so state/DOM from one
// test never leaks into the next — the single most common cause of
// order-dependent flakiness in RTL suites.
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement these; several components use them:
// - Modal's focus trap doesn't call matchMedia directly, but Next's
//   `next/font` CSS-in-JS and some libraries probe it defensively.
// - ResizeObserver: react-leaflet/leaflet's map containers.
// - IntersectionObserver: not currently used, but cheap to stub so a
//   future component (e.g. lazy-loading images) doesn't need this file
//   touched again.
// - scrollIntoView: TagInput / Modal keyboard navigation.
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as any;
  }

  if (!('ResizeObserver' in window)) {
    (window as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (!('IntersectionObserver' in window)) {
    (window as any).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  }
}
