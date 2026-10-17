// src/lib/installedApps.ts
//
// A website cannot list the apps installed on a phone, so each salon and
// barber app records itself in this browser's storage when it is installed
// or opened as an installed app, and discovery reads the list back. Storage is
// shared by every Chair App window on the same device and browser profile.
// (iPhone keeps an installed app's storage separate from Safari's, so there
// the list only shows inside the apps themselves.)

export interface InstalledApp {
  kind: 'salon' | 'barber';
  slug: string; // salon slug
  barberSlug?: string;
  name: string;
  imageUrl?: string;
  color?: string;
  at: number;
}

export const INSTALLED_APPS_KEY = 'chair_installed_apps';
const MAX = 30;

export const installedKey = (a: Pick<InstalledApp, 'kind' | 'slug' | 'barberSlug'>) =>
  a.kind === 'barber' ? `b:${a.slug}/${a.barberSlug}` : `s:${a.slug}`;

export function appPath(a: Pick<InstalledApp, 'kind' | 'slug' | 'barberSlug'>): string {
  return a.kind === 'barber' ? `/t/${a.slug}/barbers/${a.barberSlug}` : `/t/${a.slug}`;
}

function valid(a: any): a is InstalledApp {
  return a && (a.kind === 'salon' || a.kind === 'barber') && typeof a.slug === 'string' && typeof a.name === 'string' && (a.kind === 'salon' || typeof a.barberSlug === 'string');
}

export function readInstalledApps(): InstalledApp[] {
  try {
    const list = JSON.parse(localStorage.getItem(INSTALLED_APPS_KEY) || '[]');
    return Array.isArray(list) ? list.filter(valid).sort((a, b) => b.at - a.at) : [];
  } catch {
    return [];
  }
}

function write(list: InstalledApp[]) {
  try {
    localStorage.setItem(INSTALLED_APPS_KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event('chair-installed-apps'));
  } catch {
    // Private mode: the list just is not remembered.
  }
}

/** Adds (or refreshes) an app; the newest is first. */
export function recordInstalledApp(app: Omit<InstalledApp, 'at'>): void {
  const key = installedKey(app);
  const rest = readInstalledApps().filter((a) => installedKey(a) !== key);
  write([{ ...app, at: Date.now() }, ...rest]);
}

export function forgetInstalledApp(app: Pick<InstalledApp, 'kind' | 'slug' | 'barberSlug'>): void {
  const key = installedKey(app);
  write(readInstalledApps().filter((a) => installedKey(a) !== key));
}
