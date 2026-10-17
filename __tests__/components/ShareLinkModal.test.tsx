// __tests__/components/ShareLinkModal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';
import { ShareLinkModal } from '@/components/dashboard/ShareLinkModal';

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,AAA') } }));

describe('ShareLinkModal', () => {
  it('shows the full link and a QR code for the given path', async () => {
    render(
      <ToastProvider>
        <ShareLinkModal open onClose={() => {}} title="Quano Locs" path="/t/quano" help="Share this." fileName="qr.png" />
      </ToastProvider>
    );
    expect(await screen.findByText(`${window.location.origin}/t/quano`)).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'QR code for Quano Locs' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Download QR/ })).toHaveAttribute('download', 'qr.png');
    expect(screen.getByText('Share this.')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <ToastProvider>
        <ShareLinkModal open={false} onClose={() => {}} title="X" path="/t/x" help="h" fileName="q.png" />
      </ToastProvider>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
