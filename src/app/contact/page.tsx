import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';
import { SITE_NAME } from '@/lib/site';
import { SUPPORT_EMAIL } from '@/lib/support';

export const metadata: Metadata = { title: `Contact · ${SITE_NAME}` };

export default function ContactPage() {
  return (
    <LegalShell title="Contact">
      <p>
        Email us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will reply as soon as we can.
      </p>
      <h2>Customers</h2>
      <p>
        For a booking question, contact the salon directly: its phone number and address are on its page. For a problem
        with your account, email us from the address you signed up with.
      </p>
      <h2>Salons</h2>
      <p>To list your salon, or if your staff are locked out, email us with your salon name.</p>
      <h2>Forgot your password?</h2>
      <p>
        Use <a href="/login">Sign in</a> and choose &ldquo;Forgot password&rdquo;. If you do not get an email, write to
        us.
      </p>
    </LegalShell>
  );
}
