# Booking alerts (web push)

Staff can turn on "Get alerts for new bookings" on the dashboard Overview. Their
device then receives a notification when a customer books online, even with the
dashboard closed. Owners and receptionists are alerted about every booking;
a barber only about bookings made with them.

It is optional. With no keys set, the switch is hidden and nothing is sent.

## Turn it on

1. Generate a key pair once: `npx web-push generate-vapid-keys`
2. Set these environment variables where the app runs:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` (optional, for example `mailto:you@example.com`)
3. Redeploy. Keep the private key secret; changing the pair invalidates every
   saved device (staff just turn the switch on again).

## Notes

- iPhone: the dashboard must be installed to the home screen (Share, then Add to
  Home Screen) before Safari allows notifications.
- Subscriptions live in the `pushSubscriptions` collection, one row per device.
  A device the push service reports as gone (404/410) is removed automatically.
- Code: `src/lib/push.ts`, `src/app/api/push/*`, `public/sw.js` (push and click
  handlers), `src/hooks/usePushSubscription.ts`, `src/components/dashboard/PushToggle.tsx`.
