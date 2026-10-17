// __tests__/components/GuideView.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuideView } from '@/components/guide/GuideView';
import { guideById, GUIDES } from '@/lib/guide/guides';

describe('GuideView', () => {
  it('renders the title, numbered sections and an FAQ', () => {
    render(<GuideView guides={[guideById('customer')!]} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Customer Guide' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Book an appointment/ })).toBeInTheDocument();
    expect(screen.getByText('Do I need an account to book?')).toBeInTheDocument();
  });

  it('links the contents list to real sections', () => {
    render(<GuideView guides={[guideById('owner')!]} />);
    const link = screen.getByRole('link', { name: 'Set up your salon' });
    const target = document.getElementById(link.getAttribute('href')!.slice(1));
    expect(target).not.toBeNull();
  });

  it('switches guides with tabs when there are several', async () => {
    render(<GuideView guides={GUIDES.slice(0, 2)} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Owner' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Owner Guide' })).toBeInTheDocument();
  });

  it('offers printing', () => {
    render(<GuideView guides={[guideById('barber')!]} />);
    expect(screen.getByRole('button', { name: /print or save as pdf/i })).toBeInTheDocument();
  });
});
