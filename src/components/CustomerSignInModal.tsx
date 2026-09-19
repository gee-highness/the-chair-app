// src/components/CustomerSignInModal.tsx
'use client';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export function CustomerSignInModal({ open, onClose, onSignedIn }: { open: boolean; onClose: () => void; onSignedIn: () => void }) {
  const toast = useToast();
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requestCode = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/customer-auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      toast.show(data.message, 'info');
      setDevCode(data.devCode || null);
      setStage('code');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/customer-auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (res.ok) {
        toast.show('Signed in', 'success');
        setStage('email');
        setEmail('');
        setCode('');
        onSignedIn();
      } else {
        const data = await res.json();
        toast.show(data.message || 'Invalid code', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={stage === 'email' ? 'Sign in' : 'Enter your code'}>
      {stage === 'email' ? (
        <>
          <p style={{ marginTop: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            We'll send a one-time code to the email you used when booking.
          </p>
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button fullWidth loading={submitting} disabled={!email} onClick={requestCode}>
            Send code
          </Button>
        </>
      ) : (
        <>
          <p style={{ marginTop: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Enter the 6-digit code we sent to {email}.
          </p>
          {devCode && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--brass-strong)' }}>
              Dev mode — your code is: {devCode}
            </p>
          )}
          <Input label="Code" required inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <Button fullWidth loading={submitting} disabled={code.length !== 6} onClick={verifyCode}>
            Verify
          </Button>
        </>
      )}
    </Modal>
  );
}
