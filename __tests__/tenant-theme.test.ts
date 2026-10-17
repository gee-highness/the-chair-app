// __tests__/tenant-theme.test.ts
import { describe, it, expect } from 'vitest';
import { onColor, tenantThemeStyle } from '@/lib/tenantTheme';

describe('onColor', () => {
  it('uses white on dark salon colours', () => {
    expect(onColor('#0f2236')).toBe('#ffffff');
    expect(onColor('#b4521f')).toBe('#ffffff');
    expect(onColor('#2563eb')).toBe('#ffffff');
  });
  it('uses dark ink on light salon colours so buttons stay readable', () => {
    expect(onColor('#f5c518')).toBe('#14202b');
    expect(onColor('#ffffff')).toBe('#14202b');
    expect(onColor('#a8e6cf')).toBe('#14202b');
  });
  it('falls back to white for malformed colours', () => {
    expect(onColor('red')).toBe('#ffffff');
  });
});

describe('tenantThemeStyle', () => {
  it('exposes the readable text colour alongside the primary', () => {
    const style = tenantThemeStyle({ primaryColor: '#f5c518' }) as Record<string, string>;
    expect(style['--tenant-primary']).toBe('#f5c518');
    expect(style['--tenant-on-primary']).toBe('#14202b');
  });
});
