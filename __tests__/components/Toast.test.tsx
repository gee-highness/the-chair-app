// __tests__/components/Toast.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '@/components/ui/Toast';

function ShowToastButton({ message = 'Saved', tone }: { message?: string; tone?: 'success' | 'error' | 'info' }) {
  const toast = useToast();
  return <button onClick={() => toast.show(message, tone)}>Trigger</button>;
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('useToast() outside any provider returns a safe no-op instead of throwing', () => {
    const { result } = renderHook(() => useToast());
    expect(() => result.current.show('hello')).not.toThrow();
  });

  it('show() renders the message inside the provider\'s live region', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <ToastProvider>
        <ShowToastButton message="Settings saved" />
      </ToastProvider>
    );
    await user.click(screen.getByRole('button', { name: 'Trigger' }));
    expect(screen.getByText('Settings saved')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument(); // aria-live="polite" region
  });

  it('a toast auto-dismisses after its timeout', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <ToastProvider>
        <ShowToastButton message="Auto dismiss me" />
      </ToastProvider>
    );
    await user.click(screen.getByRole('button', { name: 'Trigger' }));
    expect(screen.getByText('Auto dismiss me')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('Auto dismiss me')).not.toBeInTheDocument();
  });

  it('clicking the dismiss button removes that toast immediately', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <ToastProvider>
        <ShowToastButton message="Dismiss me" />
      </ToastProvider>
    );
    await user.click(screen.getByRole('button', { name: 'Trigger' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
  });

  it('multiple toasts stack independently', async () => {
    const user = userEvent.setup({ delay: null });
    function TwoToasts() {
      const toast = useToast();
      return (
        <button
          onClick={() => {
            toast.show('First', 'success');
            toast.show('Second', 'error');
          }}
        >
          Trigger both
        </button>
      );
    }
    render(
      <ToastProvider>
        <TwoToasts />
      </ToastProvider>
    );
    await user.click(screen.getByRole('button', { name: 'Trigger both' }));
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });
});
