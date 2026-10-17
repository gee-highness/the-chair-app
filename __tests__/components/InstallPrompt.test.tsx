// __tests__/components/InstallPrompt.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

import { InstallPrompt } from '@/components/InstallPrompt';

// The dismissal is remembered per installable app (discovery, each salon,
// each barber, admin), so the storage key carries the scope.
const DISMISS_KEY = 'installPromptDismissed:/';

function fireBeforeInstallPrompt(overrides: Partial<{ prompt: () => void; userChoice: Promise<any> }> = {}) {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as any;
  event.prompt = overrides.prompt ?? vi.fn();
  event.userChoice = overrides.userChoice ?? Promise.resolve({ outcome: 'accepted' });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe('InstallPrompt', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders nothing until the browser fires beforeinstallprompt', () => {
    render(<InstallPrompt />);
    expect(screen.queryByRole('complementary', { name: 'Install app' })).not.toBeInTheDocument();
  });

  it('shows the banner once beforeinstallprompt fires', () => {
    render(<InstallPrompt />);
    fireBeforeInstallPrompt();
    expect(screen.getByRole('complementary', { name: 'Install app' })).toBeInTheDocument();
  });

  it('clicking Install calls the deferred prompt() and awaits userChoice, then hides the banner', async () => {
    const promptFn = vi.fn();
    render(<InstallPrompt />);
    fireBeforeInstallPrompt({ prompt: promptFn, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    await userEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(promptFn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('complementary', { name: 'Install app' })).not.toBeInTheDocument();
  });

  it('dismissing hides the banner and persists the dismissal in sessionStorage', async () => {
    render(<InstallPrompt />);
    fireBeforeInstallPrompt();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('complementary', { name: 'Install app' })).not.toBeInTheDocument();
    expect(sessionStorage.getItem(DISMISS_KEY)).toBe('1');
  });

  it('a previously-dismissed session never shows the banner again, even after beforeinstallprompt fires', () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    render(<InstallPrompt />);
    fireBeforeInstallPrompt();
    expect(screen.queryByRole('complementary', { name: 'Install app' })).not.toBeInTheDocument();
  });
});
