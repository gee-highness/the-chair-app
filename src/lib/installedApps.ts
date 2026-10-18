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

// v2: v1 also counted every page opened inside ANY installed app (e.g. a
// barber browsed from the Discovery app), so it listed apps that were never
// installed. A new key drops those false entries.
export const INSTALLED_APPS_KEY = 'chair_installed_apps_v2';
const LAUNCH_KEY = 'chair_launch_path';
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

/**
 * The path this window was first opened at. An installed app's window opens at
 * its own start_url, so this says which app the window IS; pages visited
 * later inside it do not make those pages installed apps.
 */
export function launchPath(): string {
  try {
    let p = sessionStorage.getItem(LAUNCH_KEY);
    if (!p) {
      p = window.location.pathname;
      sessionStorage.setItem(LAUNCH_KEY, p);
    }
    return p;
  } catch {
    return window.location.pathname;
  }
}

/** True when this window is the installed app itself (launched at its start_url, or one of its pages). */
export function windowIsApp(app: Pick<InstalledApp, 'kind' | 'slug' | 'barberSlug'>): boolean {
  const launched = launchPath();
  const base = appPath(app);
  if (launched !== base && !launched.startsWith(`${base}/`)) return false;
  // A salon's scope contains its barbers' paths, but those are separate apps.
  return app.kind === 'barber' || !launched.startsWith(`${base}/barbers/`);
}
