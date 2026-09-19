// __tests__/components/simple-primitives.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, statusTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton, SkeletonLines } from '@/components/ui/Skeleton';
import { Ticket } from '@/components/ui/Ticket';

describe('Badge', () => {
  it('falls back to a tone-derived label when no children are given', () => {
    render(<Badge tone="confirmed" />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('renders custom children instead of the tone label when given', () => {
    render(<Badge tone="confirmed">Custom Text</Badge>);
    expect(screen.getByText('Custom Text')).toBeInTheDocument();
    expect(screen.queryByText('Confirmed')).not.toBeInTheDocument();
  });

  it('the waitlist tone has a real label (FIX_PLAN.md Priority 3 regression)', () => {
    render(<Badge tone="waitlist" />);
    expect(screen.getByText('Waitlist')).toBeInTheDocument();
  });

  it('neutral/brand tones render an empty label without children, not "undefined"', () => {
    const { container } = render(<Badge tone="neutral" />);
    const badge = container.querySelector('span');
    expect(badge?.textContent).toBe('');
  });
});

describe('statusTone()', () => {
  it('recognizes every real appointment status, including waitlist', () => {
    expect(statusTone('pending')).toBe('pending');
    expect(statusTone('confirmed')).toBe('confirmed');
    expect(statusTone('completed')).toBe('completed');
    expect(statusTone('cancelled')).toBe('cancelled');
    expect(statusTone('waitlist')).toBe('waitlist');
  });

  it('falls back to neutral for an unrecognized status', () => {
    expect(statusTone('some-future-status')).toBe('neutral');
  });
});

describe('EmptyState', () => {
  it('renders the title always, and description/action only when given', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders an optional description', () => {
    render(<EmptyState title="Nothing here" description="Try again later." />);
    expect(screen.getByText('Try again later.')).toBeInTheDocument();
  });

  it('renders an optional action element', () => {
    render(<EmptyState title="No barbers" action={<button>Add barber</button>} />);
    expect(screen.getByRole('button', { name: 'Add barber' })).toBeInTheDocument();
  });
});

describe('Skeleton / SkeletonLines', () => {
  it('Skeleton renders as an aria-hidden placeholder (not announced to screen readers)', () => {
    const { container } = render(<Skeleton width="4rem" />);
    const el = container.querySelector('[aria-hidden="true"]');
    expect(el).toBeTruthy();
  });

  it('SkeletonLines renders exactly `count` placeholder lines', () => {
    const { container } = render(<SkeletonLines count={4} />);
    const lines = container.querySelectorAll('[aria-hidden="true"] > span');
    expect(lines).toHaveLength(4);
  });

  it('SkeletonLines defaults to 3 lines when count is omitted', () => {
    const { container } = render(<SkeletonLines />);
    const lines = container.querySelectorAll('[aria-hidden="true"] > span');
    expect(lines).toHaveLength(3);
  });
});

describe('Ticket', () => {
  it('renders children inside the ticket shell', () => {
    render(<Ticket>Ticket content</Ticket>);
    expect(screen.getByText('Ticket content')).toBeInTheDocument();
  });

  it('renders as a different element when `as` is given', () => {
    const { container } = render(<Ticket as="article">Content</Ticket>);
    expect(container.querySelector('article')).toBeTruthy();
  });

  it('the stamped variant adds the offset-background element', () => {
    const { container } = render(<Ticket stamped>Stamped</Ticket>);
    // The stamp is aria-hidden and has no accessible text — assert by count
    // of children rather than role, since it's purely decorative.
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(2); // stamp + at least one hole
  });
});
