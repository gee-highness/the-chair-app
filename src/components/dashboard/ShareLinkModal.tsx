// src/components/dashboard/ShareLinkModal.tsx
//
// A link, QR code and copy button for any public page of the salon (the
// salon itself, or one barber's own app), to print, show or send.
'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import styles from './ShareLinkModal.module.css';

export function ShareLinkModal({
  open,
  onClose,
  title,
  path,
  help,
  fileName,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Site path beginning with /, for example /t/acme or /t/acme/barbers/marcus. */
  path: string;
  help: string;
  fileName: string;
}) {
  const toast = useToast();
  const [qr, setQr] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    if (!path) return;
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
    <Modal open={open} onClose={onClose} title={title}>
      <div className={styles.body}>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`QR code for ${title}`} className={styles.qr} />
        )}
        <p className={styles.link}>{url}</p>
        <p className={styles.help}>{help}</p>
        <div className={styles.actions}>
          <Button onClick={copy}>Copy link</Button>
          {qr && (
            <a href={qr} download={fileName}>
              <Button variant="secondary">Download QR</Button>
            </a>
          )}
        </div>
      </div>
    </Modal>
  );
}
