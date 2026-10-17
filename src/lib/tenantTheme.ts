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
  display: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
  classic: "Georgia, 'Times New Roman', serif",
  modern: "var(--font-space-grotesk), 'Space Grotesk', system-ui, sans-serif",
};

/** Readable text colour for a fill: white on dark colours, near-black on light ones (WCAG relative luminance). */
export function onColor(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#ffffff';
  const num = parseInt(clean, 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * lin((num >> 16) & 0xff) + 0.7152 * lin((num >> 8) & 0xff) + 0.0722 * lin(num & 0xff);
  // Contrast ratio against white vs against the near-black ink (#14202b, luminance ~0.013); pick the higher.
  const againstWhite = 1.05 / (lum + 0.05);
  const againstInk = (lum + 0.05) / 0.063;
  return againstWhite >= againstInk ? '#ffffff' : '#14202b';
}

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
    '--tenant-on-primary': onColor(primary),
    '--tenant-primary-hover': shade(primary, -0.12),
    '--tenant-primary-soft': shade(primary, 0.82),
    '--tenant-secondary': secondary,
    '--tenant-font': FONT_STACKS[fontKey],
  } as CSSProperties;
}
