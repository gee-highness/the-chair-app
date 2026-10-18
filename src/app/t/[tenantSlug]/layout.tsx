// src/app/t/[tenantSlug]/layout.tsx
//
// Server layout so the salon links its OWN manifest (see src/lib/manifests.ts);
// the client chrome lives in TenantShell.
import type { Metadata } from 'next';
import { TenantShell } from './TenantShell';

export async function generateMetadata({ params }: { params: Promise<{ tenantSlug: string }> }): Promise<Metadata> {
  const { tenantSlug } = await params;
  return { manifest: `/t/${tenantSlug}/manifest.webmanifest` };
}

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <TenantShell>{children}</TenantShell>;
}
