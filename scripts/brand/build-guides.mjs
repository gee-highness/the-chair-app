// Builds the printable user-guide PDFs into docs/guides/ from the live /guide pages.
//   npm run dev   (in another terminal)
//   BASE_URL=http://localhost:3000 npm run guides:build
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const base = process.env.BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'docs/guides');
mkdirSync(out, { recursive: true });

const guides = ['customer', 'owner', 'receptionist', 'barber', 'platform'];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
for (const id of guides) {
  const page = await browser.newPage();
  await page.goto(`${base}/guide/${id}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  // Open every FAQ so the printed guide carries the answers.
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
  const file = path.join(out, `chair-app-${id}-guide.pdf`);
  await page.pdf({ path: file, format: 'A4', printBackground: true, margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' } });
  console.log('wrote', path.relative(root, file));
  await page.close();
}
await browser.close();
