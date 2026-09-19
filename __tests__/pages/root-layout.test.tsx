// __tests__/pages/root-layout.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RootLayout from '@/app/layout';

describe('RootLayout', () => {
  it('renders its children', () => {
    render(
      <RootLayout>
        <p>Page content</p>
      </RootLayout>
    );
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('includes the service-worker registration script', () => {
    const { container } = render(
      <RootLayout>
        <p>Content</p>
      </RootLayout>
    );
    const script = container.querySelector('script');
    expect(script?.textContent).toContain("navigator.serviceWorker.register('/sw.js')");
  });

  it('exports the expected page metadata (title, description)', async () => {
    const { metadata } = await import('@/app/layout');
    expect(metadata.title).toBe('The Chair App');
    expect(metadata.description).toBe('Salon and barbershop booking platform');
  });
});
