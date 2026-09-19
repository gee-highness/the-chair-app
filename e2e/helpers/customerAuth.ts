// e2e/helpers/customerAuth.ts
import { Page, expect } from '@playwright/test';

/**
 * Drives CustomerSignInModal end to end: types the email, sends the code,
 * reads the dev-mode code back off the page (only present outside
 * production — see customerAuth.ts), types it in, and verifies. Assumes
 * the sign-in modal is already open (its "Sign in" trigger button has
 * been clicked) when this is called.
 */
export async function completeSignInModal(page: Page, email: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();

  const devCodeText = page.getByText(/Dev mode — your code is:/);
  await expect(devCodeText).toBeVisible();
  const fullText = await devCodeText.textContent();
  const code = fullText?.match(/(\d{6})/)?.[1];
  if (!code) throw new Error(`Could not read dev code from page text: "${fullText}"`);

  await page.getByLabel('Code').fill(code);
  await page.getByRole('button', { name: 'Verify' }).click();
}

/** Opens the sign-in modal from a "Sign in" trigger button and completes it. */
export async function signInAsCustomer(page: Page, email: string) {
  await page.getByRole('button', { name: 'Sign in' }).click();
  await completeSignInModal(page, email);
}
