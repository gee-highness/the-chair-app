// src/components/dashboard/PushToggle.tsx
//
// "Alert me about new bookings on this device". Hidden unless the browser
// supports push and the server has it configured; explains what to do when
// notifications were blocked.
'use client';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import styles from './PushToggle.module.css';

export function PushToggle() {
  const { status, busy, enable, disable } = usePushSubscription();
  const toast = useToast();

  if (status === 'loading' || status === 'unsupported' || status === 'unavailable') return null;

  if (status === 'blocked') {
    return (
      <div className={styles.card} role="note">
        <p className={styles.text}>
          <strong>Booking alerts are blocked</strong>
          Allow notifications for this site in your browser settings, then come back to turn them on.
        </p>
      </div>
    );
  }

  const on = status === 'on';
  return (
    <div className={styles.card}>
      <p className={styles.text}>
        <strong>{on ? 'Booking alerts are on' : 'Get alerts for new bookings'}</strong>
        {on ? 'This device will buzz when a customer books, even with the dashboard closed.' : 'Your phone will buzz when a customer books, even with the dashboard closed.'}
      </p>
      <Button
        variant={on ? 'secondary' : 'primary'}
        size="sm"
        loading={busy}
        onClick={async () => {
          if (on) {
            await disable();
            toast.show('Booking alerts turned off on this device', 'info');
          } else if (await enable()) {
            toast.show('Booking alerts are on', 'success');
          }
        }}
      >
        {on ? 'Turn off' : 'Turn on alerts'}
      </Button>
    </div>
  );
}
