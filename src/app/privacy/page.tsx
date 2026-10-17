import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';
import { SITE_NAME } from '@/lib/site';
import { SUPPORT_EMAIL } from '@/lib/support';

export const metadata: Metadata = { title: `Privacy · ${SITE_NAME}` };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy" updated="October 2026">
      <p>
        {SITE_NAME} connects customers with salons and barbershops. Each salon decides which services it offers and who
        works there; we run the platform they use. This page says what we collect and why.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> name, email address, phone number and a password. Passwords are stored only as a
          one-way hash; nobody at the platform or at a salon can read yours.
        </li>
        <li>
          <strong>Your bookings:</strong> the salon, service, barber, date and time, and any note you add. The salon you
          book with can see these, along with your name and contact details, so it can serve you.
        </li>
        <li>
          <strong>What you post:</strong> reviews, comments and likes are visible to others on the salon&apos;s page.
        </li>
        <li>
          <strong>Your location,</strong> only when you ask to search near you. It is used for that search and not stored
          against your account.
        </li>
        <li>
          <strong>On your device:</strong> a sign-in cookie, and your display choices (theme, text size) saved in your
          browser.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        To run bookings, send confirmation and cancellation emails, let you sign in, keep the platform secure, and show
        salons how their business is doing. We do not sell your information.
      </p>

      <h2>Who sees it</h2>
      <p>
        The salon you book with, the platform&apos;s administrators (for support and abuse prevention), and the services
        that deliver our email and host the app. Staff only see data for their own salon.
      </p>

      <h2>Your choices</h2>
      <p>
        You can change your details from your account page, and you can ask us to delete your account and bookings by
        emailing <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Reviews and bookings a salon needs for its
        records may be anonymised rather than removed.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this page: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalShell>
  );
}
