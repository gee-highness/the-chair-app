// __tests__/pages/root-layout.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
// next/font is a build-time transform; under vitest it is just a stub.
vi.mock('next/font/google', () => ({
  Space_Grotesk: () => ({ variable: '--font-space-grotesk', className: 'font-stub' }),
}));

import RootLayout from '@/app/layout';
import { DISPLAY_PREFS_SCRIPT } from '@/lib/displayPrefs';

describe('RootLayout', () => {
  it('renders its children', () => {
    render(
      <RootLayout>
        <p>Page content</p>
      </RootLayout>
    );
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('offers a skip-to-content link as the first focusable element', () => {
    render(
      <RootLayout>
        <p>Content</p>
      </RootLayout>
    );
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link).toHaveAttribute('href', '#main-content');
  });

  it('the pre-paint script applies saved display preferences to <html>', () => {
    localStorage.setItem('chair_display', JSON.stringify({ theme: 'dark', text: 'large', contrast: true, reduceMotion: true }));
    new Function(DISPLAY_PREFS_SCRIPT)();
    const root = document.documentElement;
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.getAttribute('data-text')).toBe('large');
    expect(root.getAttribute('data-contrast')).toBe('high');
    expect(root.getAttribute('data-motion')).toBe('reduced');
    for (const a of ['data-theme', 'data-text', 'data-contrast', 'data-motion']) root.removeAttribute(a);
    localStorage.clear();
  });

  it('exports the expected page metadata (title, description)', async () => {
    const { metadata } = await import('@/app/layout');
    expect(metadata.title).toBe('The Chair App');
    expect(metadata.description).toBe('Salon and barbershop booking platform');
  });
});
