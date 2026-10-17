// src/components/dashboard/BarberAppModal.tsx
//
// Hands a salon owner everything needed to put one barber's own app in
// customers' hands: the link, a QR code to print or show, and how it installs.
'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import styles from './BarberAppModal.module.css';

export function BarberAppModal({
  open,
  onClose,
  barberName,
  path,
}: {
  open: boolean;
  onClose: () => void;
  barberName: string;
  path: string;
}) {
  const toast = useToast();
  const [qr, setQr] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    const full = `${window.location.origin}${path}`;
    setUrl(full);
    QRCode.toDataURL(full, { margin: 1, width: 440 }).then(setQr).catch(() => setQr(''));
  }, [open, path]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.show('Link copied', 'success');
    } catch {
      toast.show('Could not copy. Select the link and copy it by hand.', 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`${barberName}'s app`}>
      <div className={styles.body}>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`QR code for ${barberName}'s app`} className={styles.qr} />
        )}
        <p className={styles.link}>{url}</p>
        <p className={styles.help}>
          Customers who open this link can book {barberName.split(' ')[0]} directly and install it on their phone as
          its own app.
        </p>
        <div className={styles.actions}>
          <Button onClick={copy}>Copy link</Button>
          {qr && (
            <a href={qr} download={`${path.split('/').pop()}-qr.png`}>
              <Button variant="secondary">Download QR</Button>
            </a>
          )}
        </div>
      </div>
    </Modal>
  );
}
