// e2e/booking.spec.ts
//
// The core public journey: an anonymous visitor finds the seeded demo
// salon on the discovery homepage (regression check for FIX_PLAN.md
// Priority 3 — the homepage used to show nothing until searched), opens
// its public page, and books an appointment through all four steps of
// the real availability-driven flow.
import { test, expect } from '@playwright/test';
import { E2E_FIXTURE } from '../scripts/seed-e2e';

test.describe('public booking journey', () => {
  test('discovery homepage lists the demo salon without searching first', async ({ page }) => {
    await page.goto('/');
    // Priority 3 regression: this used to require typing a query first.
    await expect(page.getByRole('link', { name: new RegExp(E2E_FIXTURE.tenantName) })).toBeVisible();
  });

  test('tenant public page shows the seeded service/barber and links to booking', async ({ page }) => {
    await page.goto(`/t/${E2E_FIXTURE.tenantSlug}`);
    await expect(page.getByRole('heading', { name: E2E_FIXTURE.tenantName })).toBeVisible();
    await expect(page.getByText(E2E_FIXTURE.serviceName)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Book an appointment' })).toBeVisible();
  });

  test('a visitor can book an appointment end to end and sees no false email-sent claim', async ({ page }) => {
    const customerEmail = `e2e-booker-${Date.now()}@example.test`;

    await page.goto(`/t/${E2E_FIXTURE.tenantSlug}/book`);

    // Step 1 — service
    await expect(page.getByRole('heading', { name: 'Choose a service' })).toBeVisible();
    await page.getByRole('button', { name: new RegExp(E2E_FIXTURE.serviceName) }).click();

    // Step 2 — barber
    await expect(page.getByRole('heading', { name: 'Choose a barber' })).toBeVisible();
    await page.getByRole('button', { name: new RegExp(E2E_FIXTURE.barberName) }).click();

    // Step 3 — time (barber is seeded open every day, all day, so today
    // always has slots — no date-picker interaction needed)
    await expect(page.getByRole('heading', { name: 'Pick a time' })).toBeVisible();
    const slotButtons = page.locator('button').filter({ hasText: /AM|PM/ });
    await expect(slotButtons.first()).toBeVisible({ timeout: 10_000 });
    await slotButtons.first().click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 4 — contact details
    await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible();
    await page.getByLabel('Name').fill('E2E Booker');
    await page.getByLabel('Email').fill(customerEmail);
    await page.getByLabel('Phone').fill('555-0123');
    await page.getByRole('button', { name: 'Confirm booking' }).click();

    // Confirmation — and the Priority 1 regression check: no claim that an
    // email confirmation was sent (no email provider exists in this app).
    await expect(page.getByText("You're on the books")).toBeVisible();
    await expect(page.getByText(new RegExp(E2E_FIXTURE.serviceName))).toBeVisible();
    await expect(page.getByText(/sent to/i)).toHaveCount(0);
    await expect(page.getByText(/save this confirmation/i)).toBeVisible();
  });

  test('booking the exact same slot twice is rejected with the double-booking guard', async ({ page, request }) => {
    // Book slot A for customer 1 via the API directly (faster and just as
    // valid a check of the guard as going through the UI twice).
    const dayRes = await request.get(`/t/${E2E_FIXTURE.tenantSlug}`);
    expect(dayRes.ok()).toBeTruthy();

    // Discover this tenant's barber/service ids and an open slot via the
    // real public endpoints, exactly as the booking page itself does.
    const tenantInfo = await (await request.get(`/api/public/tenants/${E2E_FIXTURE.tenantSlug}`)).json();
    const service = tenantInfo.services.find((s: any) => s.name === E2E_FIXTURE.serviceName);
    const barber = tenantInfo.barbers.find((b: any) => b.name === E2E_FIXTURE.barberName);
    const today = new Date().toISOString().slice(0, 10);
    const slotsRes = await request.get(
      `/api/t/${E2E_FIXTURE.tenantSlug}/book?barberId=${barber._id}&serviceId=${service._id}&date=${today}`
    );
    const { slots } = await slotsRes.json();
    // Pick a slot far enough out that the earlier "book one appointment"
    // test in this file didn't already claim it.
    const dateTime = slots[slots.length - 1];

    const bookOnce = () =>
      request.post(`/api/t/${E2E_FIXTURE.tenantSlug}/book`, {
        data: {
          customerName: 'Double Booker',
          customerEmail: `e2e-double-${Date.now()}-${Math.random()}@example.test`,
          customerPhone: '555-0199',
          serviceId: service._id,
          barberId: barber._id,
          dateTime,
        },
      });

    const first = await bookOnce();
    expect(first.status()).toBe(201);

    const second = await bookOnce();
    expect(second.status()).toBe(409);
  });
});
