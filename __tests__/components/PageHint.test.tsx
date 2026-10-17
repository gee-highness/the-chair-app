// __tests__/components/PageHint.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageHint } from '@/components/dashboard/PageHint';

describe('PageHint', () => {
  beforeEach(() => localStorage.clear());

  it('shows the tip for a known section, linking to the guide', async () => {
    render(<PageHint section="waitlist" base="/t/demo/dashboard" />);
    expect(await screen.findByText(/Walk-ins queue here/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the guide' })).toHaveAttribute('href', '/t/demo/dashboard/guide');
  });

  it('can be dismissed, and stays dismissed', async () => {
    const { unmount } = render(<PageHint section="services" base="/t/demo/dashboard" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Hide this tip' }));
    expect(screen.queryByText(/Customers book from this menu/)).not.toBeInTheDocument();
    unmount();
    render(<PageHint section="services" base="/t/demo/dashboard" />);
    expect(screen.queryByText(/Customers book from this menu/)).not.toBeInTheDocument();
  });

  it('shows nothing for a section without a tip (guide, account)', () => {
    const { container } = render(<PageHint section="guide" base="/t/demo/dashboard" />);
    expect(container).toBeEmptyDOMElement();
  });
});
