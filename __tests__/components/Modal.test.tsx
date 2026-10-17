// __tests__/components/Modal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '@/components/ui/Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        <p>Content</p>
      </Modal>
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders with dialog ARIA semantics when open', () => {
    render(
      <Modal open onClose={() => {}} title="My Dialog">
        <p>Content</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog', { name: 'My Dialog' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('Escape key calls onClose', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="My Dialog">
        <p>Content</p>
      </Modal>
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the close button calls onClose', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="My Dialog">
        <p>Content</p>
      </Modal>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the overlay (outside the dialog) calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} title="My Dialog">
        <p>Content</p>
      </Modal>
    );
    const overlay = container.firstChild as HTMLElement;
    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking INSIDE the dialog does not call onClose', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="My Dialog">
        <button>Inner button</button>
      </Modal>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Inner button' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  // The header's close button is the first focusable element in the dialog,
  // so the trap wraps to it rather than to the first child.
  it('Tab wraps from the last focusable element back to the first (the close button)', async () => {
    const user = userEvent.setup();
    render(
      <Modal open onClose={() => {}} title="My Dialog">
        <button>First</button>
        <button>Last</button>
      </Modal>
    );
    const last = screen.getByRole('button', { name: 'Last' });
    const close = screen.getByRole('button', { name: 'Close dialog' });
    last.focus();
    expect(document.activeElement).toBe(last);
    await user.tab();
    expect(document.activeElement).toBe(close);
  });

  it('Shift+Tab wraps from the first focusable element (the close button) back to the last', async () => {
    const user = userEvent.setup();
    render(
      <Modal open onClose={() => {}} title="My Dialog">
        <button>First</button>
        <button>Last</button>
      </Modal>
    );
    const close = screen.getByRole('button', { name: 'Close dialog' });
    const last = screen.getByRole('button', { name: 'Last' });
    close.focus();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });
});
