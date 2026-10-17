// __tests__/components/DisplayMenu.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DisplayMenu } from '@/components/DisplayMenu';
import { DISPLAY_PREFS_KEY, parseDisplayPrefs } from '@/lib/displayPrefs';

describe('DisplayMenu', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-text');
  });

  it('applies and remembers a theme and text size', async () => {
    render(<DisplayMenu />);
    await userEvent.click(screen.getByRole('button', { name: /display/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));
    await userEvent.click(screen.getByRole('button', { name: 'A+' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-text')).toBe('large');
    expect(JSON.parse(localStorage.getItem(DISPLAY_PREFS_KEY)!)).toMatchObject({ theme: 'dark', text: 'large' });
  });

  it('Auto removes the forced theme; Reset restores defaults', async () => {
    render(<DisplayMenu />);
    await userEvent.click(screen.getByRole('button', { name: /display/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    await userEvent.click(screen.getByRole('button', { name: 'High contrast' }));
    await userEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(document.documentElement.getAttribute('data-contrast')).toBe('normal');
  });

  it('closes on Escape', async () => {
    render(<DisplayMenu />);
    await userEvent.click(screen.getByRole('button', { name: /display/i }));
    expect(screen.getByRole('group', { name: 'Display options' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Display options' })).not.toBeInTheDocument();
  });
});

describe('parseDisplayPrefs', () => {
  it('falls back to defaults for junk', () => {
    expect(parseDisplayPrefs('not json')).toMatchObject({ theme: 'system', text: 'normal', contrast: false });
    expect(parseDisplayPrefs('{"theme":"neon","text":"huge"}')).toMatchObject({ theme: 'system', text: 'normal' });
  });
});
