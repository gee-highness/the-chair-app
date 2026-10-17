// __tests__/components/Confirm.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider, useConfirm } from '@/components/ui/Confirm';

function Harness({ onResult }: { onResult: (v: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button onClick={async () => onResult(await confirm({ title: 'Delete it?', message: 'Gone forever', confirmLabel: 'Delete' }))}>
      ask
    </button>
  );
}

describe('ConfirmProvider', () => {
  it('resolves true when confirmed', async () => {
    const results: boolean[] = [];
    render(<ConfirmProvider><Harness onResult={(v) => results.push(v)} /></ConfirmProvider>);
    await userEvent.click(screen.getByText('ask'));
    expect(screen.getByRole('dialog', { name: 'Delete it?' })).toBeInTheDocument();
    expect(screen.getByText('Gone forever')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(results).toEqual([true]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('resolves false on cancel and on Escape', async () => {
    const results: boolean[] = [];
    render(<ConfirmProvider><Harness onResult={(v) => results.push(v)} /></ConfirmProvider>);
    await userEvent.click(screen.getByText('ask'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByText('ask'));
    await userEvent.keyboard('{Escape}');
    expect(results).toEqual([false, false]);
  });
});
