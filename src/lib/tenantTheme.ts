// src/lib/tenantTheme.ts
//
// Turns a tenant's `branding` into CSS custom properties scoped to a
// wrapper element, so each salon's public/booking surfaces carry that
// salon's own color + font on top of the shared structural design system —
// never the platform's own brass/pine identity, and never identical
// between two different tenants.
import type { CSSProperties } from 'react';

export interface TenantBranding {
  primaryColor?: string;
  secondaryColor?: string;
  font?: 'display' | 'classic' | 'modern';
  logoUrl?: string;
}

const FONT_STACKS: Record<string, string> = {
  display: "'Fraunces', 'Iowan Old Style', Georgia, serif",
  classic: "'Georgia', 'Iowan Old Style', serif",
  modern: "'Public Sans', 'Segoe UI', system-ui, sans-serif",
};

/** Lighten/darken a hex color by `amount` (-1..1) for hover/soft variants. */
function shade(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const adjust = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amount > 0 ? (255 - c) * amount : c * amount))));
  r = adjust(r);
  g = adjust(g);
  b = adjust(b);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function tenantThemeStyle(branding: TenantBranding | undefined): CSSProperties {
  const primary = branding?.primaryColor || '#2563eb';
  const secondary = branding?.secondaryColor || shade(primary, -0.3);
  const fontKey = branding?.font && FONT_STACKS[branding.font] ? branding.font : 'modern';

  return {
    '--tenant-primary': primary,
    '--tenant-primary-hover': shade(primary, -0.12),
    '--tenant-primary-soft': shade(primary, 0.82),
    '--tenant-secondary': secondary,
    '--tenant-font': FONT_STACKS[fontKey],
  } as CSSProperties;
}
