import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';
import { SITE_NAME } from '@/lib/site';
import { SUPPORT_EMAIL } from '@/lib/support';

export const metadata: Metadata = { title: `Terms · ${SITE_NAME}` };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of use" updated="October 2026">
      <p>By using {SITE_NAME} you agree to these terms.</p>

      <h2>What we are</h2>
      <p>
        {SITE_NAME} is a booking platform. The services you book are provided by the salon or barber, not by us. Prices,
        opening hours and availability are set by each salon.
      </p>

      <h2>Bookings</h2>
      <p>
        A booking is a request to the salon until it is confirmed. Please cancel in good time if you cannot come so
        someone else can take the slot. Salons may set their own cancellation and no-show rules.
      </p>

      <h2>Your account</h2>
      <p>
        Keep your password private and give accurate details. You are responsible for what happens under your account.
        Staff accounts are for the named person only.
      </p>

      <h2>Reviews and posts</h2>
      <p>
        Be honest and respectful. We may remove content that is abusive, misleading or unlawful, and may suspend accounts
        that repeatedly break these rules.
      </p>

      <h2>Salons</h2>
      <p>
        Salons are responsible for the accuracy of what they publish and for how they treat customers&apos; information.
        We may suspend a salon that misuses the platform.
      </p>

      <h2>Liability</h2>
      <p>
        We work to keep the platform available but cannot promise it will always be uninterrupted. To the extent the law
        allows, we are not liable for losses arising from a salon&apos;s services or from downtime.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalShell>
  );
}
