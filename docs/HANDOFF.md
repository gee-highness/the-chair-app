# Chair App: handoff notes (2026-10-19)

Point a new session at this file to continue the work.

## Next task
Continue checking what is missing in the Chair App that exists in Servo POS (`gee-highness/servo-pos`, the reference). Compare feature by feature (customer app, POS/dashboard, admin, payments, loyalty, growth, notifications, guides) and report the gaps in a ranked list before building anything. The "Still open" list below is the starting point, not the full answer.

## Where things stand
- Repo: `gee-highness/the-chair-app` (Next.js 15, React 19, MongoDB). Everything is merged to `main` (PR #1 app overhaul, PR #2 CI). Last merge commit: `ce60bf6`.
- `gee-highness/servo-pos` was only used as the reference. No changes were made there.
- Working branch name used in the sandbox: `claude/chair-app-server-parity-ujg72h`. It is fully merged. For new work, restart it from the latest `main`:
  `git fetch origin main && git checkout -B claude/chair-app-server-parity-ujg72h origin/main`
- Local clone: `/home/user/the-chair-app`. Do not open PRs unless asked.

## What was built (all on `main`)
- **Design:** Servo's structure (radii, glow, bottom tab bars, splash) in the Chair's own "midnight and copper" palette. Tokens in `src/styles/tokens.css` (names kept: `--brass` = copper accent, `--pine` = midnight, `--on-brass` for text on accent). Font: Space Grotesk only.
- **Logo:** drawn once in `scripts/brand/chair.svg`. `npm run brand:build` regenerates favicon, apple icon, PWA/maskable/admin icons and `src/components/logoMarkSvg.ts`.
- **Apps:** discovery (`/`), each salon (`/t/<slug>`), each barber (`/t/<slug>/barbers/<barber>`) and admin (`/admin`) are separate installable PWAs (own manifest, scope, service-worker cache; see `src/lib/pwaScope.ts`, `public/sw.js`).
- **Installed mode:** `useStandalone` hides the back arrow in installed salon apps and shows a Discover button/tab that opens discovery in its own window. Installed apps record themselves in localStorage (`src/lib/installedApps.ts`); discovery shows "Your apps" and "Installed" badges.
- **Discovery:** hero search, quick picks, featured barbers, richer cards, sort, 4+ filter. `/api/public/search` returns ratings, price-from, barbers.
- **Booking:** summary chips, 14-day strip, grouped times, add to calendar, no-payment note. Customers can cancel upcoming bookings (`PATCH /api/t/<slug>/my-appointments`).
- **Dashboard:** greeting, pending alert, next-up card, nav badge, per-page tips, CSV export, print layouts, Share link/QR (`ShareLinkModal`), barber app link/QR.
- **Booking alerts (web push):** optional, see `docs/PUSH.md`. Needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, optional `VAPID_SUBJECT`. Keys were generated in chat; they are NOT stored in the repo. Generate new ones with `npx web-push generate-vapid-keys` if unsure.
- **Guides:** five role guides (`src/lib/guide/guides.ts`), pages `/guide`, dashboard/admin Guide tab, PDFs in `docs/guides` (`npm run guides:build` with a dev server running and `BASE_URL`).
- **Other:** Privacy/Terms/Contact pages (need legal review), Display menu (theme, text size, contrast, motion), confirm dialogs (`useConfirm`), skip link, share-card images (`opengraph-image.tsx`), react-leaflet 5, CI (`.github/workflows/ci.yml`).
- **Removed:** the dead email-code endpoints `customer-auth/request` and `verify`; committed `.next` output.

## Mobile and desktop pass (2026-10-19)
- Root cause of the "tiny desktop layout on a phone" bug: page wrappers centred with `margin: 0 auto` inside the flex-column `.app-root` shrink-wrapped their content, so one wide rail widened the page and the phone zoomed out. Fixed globally in `tokens.css` (`:where(.app-root > *) { width: 100% }`), guarded by `__tests__/layout-css.test.ts`.
- Dashboard and admin phone navigation: three tabs plus a **More** sheet (`MobileMoreSheet`) instead of a 13-item sideways-scrolling bar.
- Salon tab bar uses line icons (no emoji); page headers wrap; filters, location row and charts fit on phones; touch targets and map controls are thumb-sized; discovery is wider on desktop with a responsive salon grid.
- Audit method: seed an in-memory Mongo (`mongodb-memory-server`), `next build && next start`, then Playwright at 390x844 (isMobile) and 1280x800 over every route, measuring overflow, small targets and tiny text. Use a production build; `next dev` recompiles stall the run. Pass the viewport as `viewport: {width,height}` (top-level width/height is ignored).

## How to run and verify
- Install: `npm ci`. Node 22. `MONGODB_URI` must exist to build or run (any value for build/tests; tests use an in-memory fake).
- Checks (same as CI): `npx tsc --noEmit`, `npm run test:unit` (584 tests), `npm run build`.
- Dev server: `MONGODB_URI=mongodb://localhost:27017/x npx next dev -p <port>`. Without that variable, salon pages 500 because the share-image route imports the database module.
- Screenshots: Playwright with `/opt/pw-browsers/chromium`; mock `**/api/**` with `page.route`. A throwaway preview page under `src/app/zz-*` was used for dashboard shells, then deleted.

## Gotchas learned
- Never `pkill -f` a pattern that appears in your own command line (it killed the shell twice). Kill by port: `kill $(lsof -ti:<port>)`.
- `.next` is gitignored now. `git checkout -- .next` is no longer needed.
- Do not leave dev servers running; the stop hook complains about uncommitted changes.
- After `npm install --no-save`, extra packages can be pruned; `@testing-library/dom` is now a declared devDependency.
- Vitest exits non-zero on unhandled errors even if tests pass: register every route a page fetches in `mockFetch`.
- Use `bodyOf(call)` from `__tests__/helpers/fetchMock.ts` instead of `JSON.parse(call[1].body)` (type errors).
- Field labels draw the required asterisk with CSS so label text stays e.g. "Email".

## Still open
- Set `VAPID_*` in the host, run `npm run db:init` once, deploy. Real-phone check of installed apps, discovery and the Discover button (iPhone storage is separate from Safari).
- Legal review of Privacy/Terms.
- Playwright e2e tests are not in CI and were never run against a real database.
- Not built: payments/deposits, appointment reminders (email/SMS/WhatsApp) and waitlist-opened messages, customer rescheduling, barber time off/holidays, loyalty reward redemption, referrals, gift cards/packages/add-ons, salon plans/billing, multiple languages, customer self-service account deletion, error monitoring/backups, image optimisation.
- Suggested next order: payments or deposits, reminders, rescheduling.
