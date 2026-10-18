// src/hooks/useInstalledApps.ts
//
// Read side: the apps this device has installed (see lib/installedApps.ts).
// Write side: useRecordInstall, called by a salon or barber page, records the
// app when it is installed or when it is opened as an installed app.
'use client';
import { useEffect, useState } from 'react';
import { InstalledApp, forgetInstalledApp, readInstalledApps, recordInstalledApp, windowIsApp } from '@/lib/installedApps';
import { isStandalone } from './useStandalone';

export function useInstalledApps() {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  useEffect(() => {
    const load = () => setApps(readInstalledApps());
    load();
    window.addEventListener('chair-installed-apps', load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener('chair-installed-apps', load);
      window.removeEventListener('storage', load);
    };
  }, []);
  return { apps, forget: forgetInstalledApp };
}

/** Pass null until the app's details are known. */
export function useRecordInstall(app: Omit<InstalledApp, 'at'> | null) {
  const key = app ? `${app.kind}|${app.slug}|${app.barberSlug ?? ''}|${app.name}|${app.imageUrl ?? ''}|${app.color ?? ''}` : '';
  useEffect(() => {
    if (!app) return;
    // Standalone alone is not proof: a barber opened inside the salon's (or
    // Discovery's) installed window is standalone too. The window must have
    // been launched into this very app.
    if (isStandalone() && windowIsApp(app)) recordInstalledApp(app);
    const onInstalled = () => recordInstalledApp(app);
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
    // `key` captures every field of `app` that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
